import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 프로젝트 루트를 sys.path에 추가하여 MIDAS_API 패키지 import 가능하게 함
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import MIDAS_API as MIDAS

base_url = os.environ.get("MIDAS_BASE_URL", "")
api_key = os.environ.get("MIDAS_API_KEY", "")

if base_url:
    MIDAS.MIDAS_API_BASEURL(base_url)
if api_key:
    MIDAS.MIDAS_API_KEY(api_key)

app = FastAPI(title="MIDAS GEN NX Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import midas as midas_router
from routers import settings as settings_router
from routers import project as project_router

app.include_router(midas_router.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(project_router.router, prefix="/api")


@app.get("/health")
def health_check():
    try:
        configured_url = MIDAS.MIDAS_API_BASEURL.get_url()
        configured_key = bool(MIDAS.MIDAS_API_KEY.get_key())
    except AttributeError:
        configured_url = ""
        configured_key = False
    return {
        "status": "ok",
        "configured": bool(configured_url and configured_key),
        "base_url": configured_url,
    }
