"""JWT 토큰 생성/검증 및 인증 미들웨어"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
import hmac
import secrets

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from db import get_db
from models.auth import User

# JWT 설정
_SECRET_KEY = os.environ.get("JWT_SECRET", "midas-dashboard-secret-key-change-in-production")
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 24

# Bearer 토큰 추출
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """SHA-256 + salt 해싱"""
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${h}"


def verify_password(plain: str, hashed: str) -> bool:
    """해시 검증"""
    if "$" not in hashed:
        return False
    salt, stored_hash = hashed.split("$", 1)
    h = hashlib.sha256((salt + plain).encode()).hexdigest()
    return hmac.compare_digest(h, stored_hash)


def create_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    payload = {"sub": username, "role": role, "exp": expire}
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])


def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """현재 로그인한 사용자를 반환. 토큰 없거나 유효하지 않으면 401."""
    if cred is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다")
    try:
        payload = decode_token(cred.credentials)
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 만료되었거나 유효하지 않습니다")

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """관리자 권한 확인"""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다")
    return user
