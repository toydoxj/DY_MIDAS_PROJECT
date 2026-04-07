"""인증 라우터 — 로그인, 회원가입, 사용자 관리"""

from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models.auth import (
    User, LoginRequest, RegisterRequest, TokenResponse,
    UserInfo, UserUpdateRequest,
)
import MIDAS_API as MIDAS
from auth_middleware import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin,
)

router = APIRouter(prefix="/auth")


def _user_to_info(user: User) -> UserInfo:
    return UserInfo(
        id=user.id,
        username=user.username,
        name=user.name or "",
        role=user.role or "user",
        status=user.status or "active",
        midas_url=user.midas_url or "",
        work_dir=user.work_dir or "",
        has_midas_key=bool(user.midas_key),
    )


@router.get("/status")
def auth_status(db: Session = Depends(get_db)) -> dict:
    """인증 상태 확인 — 사용자가 0명이면 초기 설정 필요"""
    count = db.query(User).count()
    return {"initialized": count > 0, "user_count": count}


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """사용자 등록. DB가 비어있으면 관리자로, 아니면 관리자 권한 필요."""
    user_count = db.query(User).count()

    # 이미 사용자가 있으면 이 엔드포인트로 직접 등록 불가 (관리자용 별도 엔드포인트 사용)
    if user_count > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자를 통해 등록해주세요")

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 아이디입니다")

    # 최초 사용자 = 관리자
    sid = uuid4().hex
    user = User(
        username=body.username,
        password=hash_password(body.password),
        name=body.name,
        role="admin",
        session_id=sid,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.username, user.role, sid)
    return TokenResponse(access_token=token, user=_user_to_info(user))


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """로그인 → JWT 토큰 반환"""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    if user.status == "pending":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="가입 승인 대기 중입니다. 관리자에게 문의하세요.")
    if user.status == "rejected":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="가입이 거절되었습니다.")

    # 세션 ID 생성 (이전 세션 자동 만료)
    sid = uuid4().hex
    user.session_id = sid
    db.commit()

    # 로그인 시 사용자의 MIDAS 설정 적용
    if user.midas_url:
        MIDAS.MIDAS_API_BASEURL(user.midas_url)
    if user.midas_key:
        MIDAS.MIDAS_API_KEY(user.midas_key)

    token = create_token(user.username, user.role, sid)
    return TokenResponse(access_token=token, user=_user_to_info(user))


@router.get("/me")
def get_me(user: User = Depends(get_current_user)) -> UserInfo:
    """현재 로그인한 사용자 정보"""
    return _user_to_info(user)


@router.put("/me")
def update_me(body: UserUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserInfo:
    """내 정보 수정"""
    if body.name is not None:
        user.name = body.name
    if body.password is not None:
        user.password = hash_password(body.password)
    if body.midas_url is not None:
        user.midas_url = body.midas_url
    if body.midas_key is not None:
        user.midas_key = body.midas_key
    if body.work_dir is not None:
        user.work_dir = body.work_dir
    db.commit()
    db.refresh(user)
    return _user_to_info(user)


# ── 관리자 전용 ──

@router.post("/users")
def create_user(body: RegisterRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> UserInfo:
    """관리자가 사용자 등록"""
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 아이디입니다")

    user = User(
        username=body.username,
        password=hash_password(body.password),
        name=body.name,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_info(user)


@router.post("/request")
def request_join(body: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    """가입 신청 (누구나 가능) — pending 상태로 저장"""
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 아이디입니다")

    user = User(
        username=body.username,
        password=hash_password(body.password),
        name=body.name,
        role="user",
        status="pending",
    )
    db.add(user)
    db.commit()
    return {"status": "pending", "message": "가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요."}


@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[UserInfo]:
    """사용자 목록 (관리자만)"""
    users = db.query(User).order_by(User.id).all()
    return [_user_to_info(u) for u in users]


@router.post("/users/{user_id}/approve")
def approve_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> UserInfo:
    """가입 승인 (관리자만)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")
    user.status = "active"
    db.commit()
    db.refresh(user)
    return _user_to_info(user)


@router.post("/users/{user_id}/reject")
def reject_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    """가입 거절 (관리자만)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")
    user.status = "rejected"
    db.commit()
    return {"status": "rejected"}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    """사용자 삭제 (관리자만, 자기 자신 삭제 불가)"""
    if admin.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신은 삭제할 수 없습니다")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}
