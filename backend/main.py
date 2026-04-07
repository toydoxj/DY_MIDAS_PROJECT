import os
import sys

# PyInstaller 번들 여부에 따라 경로 설정
if getattr(sys, "frozen", False):
    # PyInstaller exe: _MEIPASS 임시 디렉토리에 번들된 파일들이 있음
    _BASE_DIR: str = sys._MEIPASS
    _PROJECT_ROOT: str = os.path.dirname(sys.executable)
else:
    _BASE_DIR = os.path.dirname(__file__)
    _PROJECT_ROOT = os.path.join(_BASE_DIR, "..")

# MIDAS_API 패키지를 import할 수 있도록 경로 추가
sys.path.insert(0, _BASE_DIR)
sys.path.insert(0, _PROJECT_ROOT)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# .env 파일 탐색: 여러 경로 후보를 시도
_env_candidates: list[str] = [
    os.path.join(_PROJECT_ROOT, ".env"),           # 개발: 프로젝트 루트 (backend/../.env)
    os.path.join(os.getcwd(), ".env"),              # cwd에서 직접
    os.path.join(os.getcwd(), "..", ".env"),         # cwd 상위 (backend/ → ../)
    os.path.join(_PROJECT_ROOT, "..", ".env"),       # exe 상위 디렉토리
    os.path.join(_PROJECT_ROOT, "..", "..", ".env"), # exe 2단계 상위
]
_env_loaded: bool = False
for _candidate in _env_candidates:
    _abs: str = os.path.abspath(_candidate)
    if os.path.isfile(_abs):
        load_dotenv(_abs)
        _env_loaded = True
        break
if not _env_loaded:
    load_dotenv()  # 기본 탐색

# gmaps.env: Google Maps 키만 별도 로드 (번들 포함용, .env와 겹쳐도 override하지 않음)
_gmaps_candidates: list[str] = [
    os.path.join(_BASE_DIR, "gmaps.env"),
    os.path.join(_PROJECT_ROOT, "gmaps.env"),
]
for _gc in _gmaps_candidates:
    if os.path.isfile(_gc):
        load_dotenv(_gc, override=False)
        break

import MIDAS_API as MIDAS

base_url: str = os.environ.get("MIDAS_BASE_URL", "")
api_key: str = os.environ.get("MIDAS_API_KEY", "")
google_api_key: str = os.environ.get("GOOGLE_API_KEY", "")

if base_url:
    MIDAS.MIDAS_API_BASEURL(base_url)
if api_key:
    MIDAS.MIDAS_API_KEY(api_key)

from exceptions import MidasError
from db import init_db

app = FastAPI(title="MIDAS GEN NX Dashboard API", version="1.0.2")


@app.exception_handler(MidasError)
async def midas_error_handler(request: Request, exc: MidasError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth as auth_router
from routers import midas as midas_router

# DB 초기화 (라우터 import 후 — User 모델이 Base에 등록된 상태)
init_db()
from routers import settings as settings_router
from routers import project as project_router
from routers import loadcase as loadcase_router
from routers import analysis as analysis_router
from routers import floorload as floorload_router
from routers import member as member_router
from routers import seismic_cert as seismic_cert_router

app.include_router(auth_router.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(project_router.router, prefix="/api")
app.include_router(loadcase_router.router, prefix="/api")
app.include_router(analysis_router.router, prefix="/api")
app.include_router(floorload_router.router, prefix="/api")
app.include_router(member_router.router, prefix="/api")
app.include_router(seismic_cert_router.router, prefix="/api")
# midas 와일드카드 라우터는 반드시 마지막에 등록
app.include_router(midas_router.router, prefix="/api")


@app.get("/api/gmaps-key")
def get_gmaps_key() -> dict[str, str]:
    return {"key": google_api_key}


@app.get("/health")
def health_check() -> dict[str, object]:
    try:
        configured_url: str = MIDAS.MIDAS_API_BASEURL.get_url()
        configured_key: bool = bool(MIDAS.MIDAS_API_KEY.get_key())
    except AttributeError:
        configured_url = ""
        configured_key = False
    return {
        "status": "ok",
        "configured": bool(configured_url and configured_key),
        "base_url": configured_url,
    }


# 정적 빌드된 프론트엔드 서빙 (API 라우터 뒤에 등록)
if getattr(sys, "frozen", False):
    _static_dir: str = os.path.join(_BASE_DIR, "frontend_out")
else:
    _static_dir = os.path.join(_PROJECT_ROOT, "frontend", "out")

if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    port: int = int(os.environ.get("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
