"""SQLAlchemy + SQLite 데이터베이스 초기화"""

import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# DB 파일 위치: AppData(Electron) 또는 프로젝트 루트(개발)
if getattr(sys, "frozen", False):
    _DB_DIR = os.path.join(os.environ.get("APPDATA", ""), "midas-gen-nx-dashboard")
else:
    _DB_DIR = os.path.join(os.path.dirname(__file__), "..")

os.makedirs(_DB_DIR, exist_ok=True)
_DB_PATH = os.path.join(_DB_DIR, "dashboard.db")

engine = create_engine(f"sqlite:///{_DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Depends용 DB 세션 제너레이터"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """테이블 생성 (앱 시작 시 호출)"""
    Base.metadata.create_all(bind=engine)
