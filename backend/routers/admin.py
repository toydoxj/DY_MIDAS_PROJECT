"""관리자 라우터 — DY_MIDAS 자체 access log.

- POST /api/admin/track-login — 인증된 사용자가 로그인 직후 호출.
  JWT의 sid를 UNIQUE 키로 써서 동일 세션 중복 INSERT를 막는다.
- GET /api/admin/access-log — admin 전용. 사용자 요약 + 최근 이벤트.

사용자 관리(승인/거절/role 변경)는 task.dyce.kr 측에 있으므로 본 라우터는
"본 앱 사용 현황" 추적만 담당한다.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel

import access_log
from auth_middleware import (
    CurrentUser,
    decode_token,
    get_current_user,
    require_admin,
)

router = APIRouter(prefix="/admin")
_bearer = HTTPBearer(auto_error=False)


class TrackLoginRequest(BaseModel):
    app_version: Optional[str] = None


def _extract_sid(cred: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    if not cred:
        return None
    try:
        payload = decode_token(cred.credentials)
        sid = payload.get("sid")
        return str(sid) if sid else None
    except JWTError:
        return None


def _client_ip(request: Request) -> str:
    # Electron sidecar는 보통 127.0.0.1만 받지만, 로컬 네트워크 배포 가능성도 있어 X-Forwarded-For도 수용.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


@router.post("/track-login")
def track_login(
    body: TrackLoginRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    user_agent: Optional[str] = Header(default=None, alias="user-agent"),
) -> dict:
    sid = _extract_sid(cred)
    inserted = access_log.insert_event(
        user_id=user.id,
        username=user.username,
        name=user.name,
        email=user.email,
        role=user.role,
        sid=sid,
        ip=_client_ip(request),
        user_agent=user_agent or "",
        app_version=(body.app_version or "")[:64],
        ts=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    return {"recorded": inserted, "duplicate": not inserted}


@router.get("/access-log")
def get_access_log(
    limit: int = 200,
    _: CurrentUser = Depends(require_admin),
) -> dict:
    return {
        "users": access_log.list_users_summary(),
        "recent": access_log.list_recent(limit=limit),
    }
