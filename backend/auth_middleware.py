"""인증 미들웨어 — 동양구조 업무관리(api.dyce.kr)에 인증을 위임한다.

- JWT 검증은 자체적으로 수행 (JWT_SECRET 공유)
- 사용자 정보(name/role/midas_url 등)는 https://api.dyce.kr/api/auth/me로 fetch
- midas_key는 별도 endpoint /api/auth/me/midas 로만 fetch (보안)
- 자체 user 테이블/SQLite 없음 (가입/관리 모두 task.dyce.kr 측에서)
"""

import os
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

# 동양구조 업무관리와 공유. 양쪽 환경변수가 일치해야 토큰 호환.
_SECRET_KEY = os.environ.get("JWT_SECRET", "")
_ALGORITHM = "HS256"
# 인증/사용자 정보 발급 서버 (운영=task.dyce.kr 백엔드)
_AUTH_API = os.environ.get("AUTH_API_URL", "https://api.dyce.kr").rstrip("/")

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    """동양구조 /api/auth/me 응답의 dataclass wrap. SQLAlchemy User를 대체."""

    id: int
    username: str
    name: str
    email: str
    role: str
    status: str
    midas_url: str
    has_midas_key: bool
    work_dir: str


def decode_token(token: str) -> dict:
    return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])


def _validate_token(cred: Optional[HTTPAuthorizationCredentials]) -> str:
    """토큰 자체 검증 → 원본 JWT string 반환 (이후 우리 API에 forward)."""
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다"
        )
    try:
        payload = decode_token(cred.credentials)
        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰"
            )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었거나 유효하지 않습니다",
        ) from exc
    return cred.credentials


def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> CurrentUser:
    """동양구조 백엔드에서 user 정보를 fetch."""
    token = _validate_token(cred)
    try:
        with httpx.Client(timeout=10) as http:
            r = http.get(
                f"{_AUTH_API}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="다른 기기에서 로그인되었거나 세션 만료",
                )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"인증 서버 통신 실패: {exc}",
        ) from exc
    return CurrentUser(
        id=int(data["id"]),
        username=str(data["username"]),
        name=str(data.get("name") or ""),
        email=str(data.get("email") or ""),
        role=str(data.get("role") or "member"),
        status=str(data.get("status") or "active"),
        midas_url=str(data.get("midas_url") or ""),
        has_midas_key=bool(data.get("has_midas_key")),
        work_dir=str(data.get("work_dir") or ""),
    )


def get_my_midas_key(token: str) -> str:
    """현재 사용자의 midas_key 가져오기 (login/세션 초기화 시점에 사용).

    /api/auth/me 응답에는 has_midas_key boolean만 있어 midas_key 자체는 별도 fetch.
    """
    try:
        with httpx.Client(timeout=10) as http:
            r = http.get(
                f"{_AUTH_API}/api/auth/me/midas",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            return str(r.json().get("midas_key") or "")
    except httpx.HTTPError:
        return ""


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다"
        )
    return user
