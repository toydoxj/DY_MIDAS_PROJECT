"""인증 미들웨어 — 동양구조 업무관리(api.dyce.kr)에 인증을 완전 위임한다.

- JWT 검증을 sidecar에서 수행하지 않는다 → 사용자 PC에 JWT_SECRET 배포 불필요.
- token 문자열은 task /api/auth/me 로 forward, task가 secret 검증 + user 정보 반환.
- midas_key는 별도 endpoint /api/auth/me/midas 로만 fetch (보안)
- 자체 user 테이블/SQLite 없음 (가입/관리 모두 task.dyce.kr 측에서)
"""

import os
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt

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


def peek_unverified_claims(token: str) -> dict:
    """검증 없이 JWT payload만 base64 decode — sid/sub 등 식별자 추출용.

    실제 인증 검증(서명/만료)은 task /api/auth/me 위임이 담당하므로 secret 불필요.
    invalid token이면 task 호출 단계에서 401로 거절된다.
    """
    try:
        return jwt.get_unverified_claims(token)
    except Exception:
        return {}


def _validate_token(cred: Optional[HTTPAuthorizationCredentials]) -> str:
    """헤더 존재만 확인 → 원본 JWT string을 task로 forward.

    실제 토큰 검증(서명/만료/sub)은 task /api/auth/me 가 담당.
    """
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다"
        )
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
