"""사용자 인증 모델 (SQLAlchemy 테이블 + Pydantic 스키마)"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime
from db import Base


# ── SQLAlchemy ORM 모델 ──

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)  # bcrypt 해시
    name = Column(String, default="")
    role = Column(String, default="user")  # "admin" | "user"
    midas_url = Column(String, default="")
    midas_key = Column(String, default="")
    work_dir = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Pydantic 요청/응답 스키마 ──

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    username: str
    name: str
    role: str
    midas_url: str = ""
    work_dir: str = ""
    has_midas_key: bool = False

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    midas_url: Optional[str] = None
    midas_key: Optional[str] = None
    work_dir: Optional[str] = None
