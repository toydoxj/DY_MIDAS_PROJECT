"""인증 라우터 — 자체 발급 X. 모두 동양구조 업무관리(api.dyce.kr)에 위임.

남은 엔드포인트:
- GET /api/auth/me — 현재 사용자 정보 (CurrentUser dataclass 그대로 반환)
- PUT /api/auth/me — 우리 자격 + MIDAS 자격 변경 (api.dyce.kr 로 forward)

발급/관리(register/login/users 등)는 task.dyce.kr/login 또는 task.dyce.kr/admin/users 에서.
"""

import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel

import MIDAS_API as MIDAS
from auth_middleware import CurrentUser, get_current_user, get_my_midas_key

_AUTH_API = os.environ.get("AUTH_API_URL", "https://api.dyce.kr").rstrip("/")

router = APIRouter(prefix="/auth")


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    midas_url: Optional[str] = None
    midas_key: Optional[str] = None
    work_dir: Optional[str] = None


def _user_to_info(user: CurrentUser) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "midas_url": user.midas_url,
        "has_midas_key": user.has_midas_key,
        "work_dir": user.work_dir,
    }


@router.get("/me")
def get_me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return _user_to_info(user)


@router.put("/me")
def update_me(
    body: UserUpdateRequest,
    request: Request,
    authorization: str = Header(...),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """본인 정보 변경 — 동양구조 백엔드로 forward."""
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="변경할 필드가 없습니다")
    try:
        with httpx.Client(timeout=10) as http:
            r = http.put(
                f"{_AUTH_API}/api/auth/me",
                headers={
                    "Authorization": authorization,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            r.raise_for_status()
            updated = r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail=f"인증 서버 통신 실패: {exc}"
        ) from exc

    # midas_url / midas_key 변경 시 sidecar의 MIDAS API 설정 즉시 반영
    if "midas_url" in payload and updated.get("midas_url"):
        MIDAS.MIDAS_API_BASEURL(updated["midas_url"])
    if "midas_key" in payload and payload["midas_key"]:
        MIDAS.MIDAS_API_KEY(payload["midas_key"])
    return updated


@router.get("/status")
def auth_status() -> dict:
    """초기화 여부는 동양구조 백엔드에 위임."""
    try:
        with httpx.Client(timeout=10) as http:
            r = http.get(f"{_AUTH_API}/api/auth/status")
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail=f"인증 서버 통신 실패: {exc}"
        ) from exc


__all__ = ["router", "get_my_midas_key"]
