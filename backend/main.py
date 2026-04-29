import os
import sys
import io

# PyInstaller exe에서 midas_gen 배너의 유니코드 문자(╭╰ 등)가
# cp949 인코딩에서 깨지는 문제 방지
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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

# MIDAS 설정 우선순위:
#   1) midas_settings.json (settings.py 의 _load_saved_settings()가 SSOT)
#   2) .env 환경변수 (아래 — 파일이 없을 때만 사용되는 부트스트랩)
# settings.py가 라우터 import 시점에 _load_saved_settings()를 호출해 (1)을 적용하면
# 아래 (2)의 적용분이 자연스럽게 덮어쓰여진다 (.env가 fallback 역할).
if base_url:
    MIDAS.MIDAS_API_BASEURL(base_url)
if api_key:
    MIDAS.MIDAS_API_KEY(api_key)

from exceptions import MidasError

app = FastAPI(title="MIDAS GEN NX Dashboard API", version="1.3.3")


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

# 인증/사용자 관리는 동양구조 업무관리(api.dyce.kr)에 위임 — 자체 DB 없음
from routers import settings as settings_router
from routers import project as project_router
from routers import loadcase as loadcase_router
from routers import analysis as analysis_router
from routers import floorload as floorload_router
from routers import member as member_router
from routers import slab_span as slab_span_router
from routers import load_map as load_map_router
from routers import project_settings as project_settings_router
from routers import seismic_cert as seismic_cert_router
from routers import admin as admin_router

app.include_router(auth_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(project_router.router, prefix="/api")
app.include_router(loadcase_router.router, prefix="/api")
app.include_router(analysis_router.router, prefix="/api")
app.include_router(floorload_router.router, prefix="/api")
app.include_router(member_router.router, prefix="/api")
app.include_router(slab_span_router.router, prefix="/api")
app.include_router(load_map_router.router, prefix="/api")
app.include_router(project_settings_router.router, prefix="/api")
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
    except (Exception, SystemExit):
        # midas_gen 내부에서 키 미설정 시 SystemExit을 던지므로 함께 차단
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
