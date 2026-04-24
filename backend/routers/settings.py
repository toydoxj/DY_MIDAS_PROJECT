import json
import os

from fastapi import APIRouter
from pydantic import BaseModel
import MIDAS_API as MIDAS
from MIDAS_API._client import MidasAuthExpiredError

from models.settings import SettingsResponse, SettingsUpdateRequest, ConnectionTestResponse
import work_dir

router = APIRouter()

# MIDAS 설정 파일 경로 (work_dir 모듈의 _APP_DATA 재사용)
from work_dir import _APP_DATA
_SETTINGS_FILE = os.path.join(_APP_DATA, "midas_settings.json")


def _load_saved_settings():
    """midas_settings.json 을 읽어 MIDAS 전역 설정에 적용한다.

    이 함수가 MIDAS API 설정의 단일 진실 소스(SSOT)다.
    - main.py 의 .env 적용은 부트스트랩 fallback (파일이 없을 때만 의미)
    - routers/auth.py 는 의도적으로 전역을 건드리지 않음 (사용자 메모만 저장)
    """
    if not os.path.isfile(_SETTINGS_FILE):
        return
    try:
        with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("base_url"):
            MIDAS.MIDAS_API_BASEURL(data["base_url"])
        if data.get("api_key"):
            MIDAS.MIDAS_API_KEY(data["api_key"])
    except Exception:
        pass


def _save_settings(base_url: str = "", api_key: str = ""):
    """MIDAS 설정을 파일에 영구 저장"""
    # 기존 설정 로드
    existing = {}
    if os.path.isfile(_SETTINGS_FILE):
        try:
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    if base_url:
        existing["base_url"] = base_url
    if api_key:
        existing["api_key"] = api_key

    os.makedirs(os.path.dirname(_SETTINGS_FILE), exist_ok=True)
    with open(_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)


# 앱 시작 시 저장된 설정 자동 로드
_load_saved_settings()


@router.get("/settings")
def get_settings() -> SettingsResponse:
    try:
        base_url: str = MIDAS.MIDAS_API_BASEURL.get_url()
    except (Exception, SystemExit):
        base_url = ""
    try:
        key: str = MIDAS.MIDAS_API_KEY.get_key()
        masked: str = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    except (Exception, SystemExit):
        masked = ""
    return SettingsResponse(base_url=base_url, api_key_masked=masked)


@router.post("/settings")
def update_settings(body: SettingsUpdateRequest) -> dict[str, str]:
    if body.base_url:
        MIDAS.MIDAS_API_BASEURL(body.base_url)
    if body.api_key:
        MIDAS.MIDAS_API_KEY(body.api_key)
    # 파일에 영구 저장
    _save_settings(base_url=body.base_url or "", api_key=body.api_key or "")
    return {"status": "updated"}


class WorkDirRequest(BaseModel):
    path: str


@router.get("/work-dir")
def get_work_dir_endpoint() -> dict[str, str | None]:
    """현재 작업 폴더 경로를 반환. 폴더가 없으면 에러 상태 포함."""
    path, error = work_dir.get_work_dir_safe()
    return {"path": path, "error": error}


@router.post("/work-dir")
def set_work_dir_endpoint(body: WorkDirRequest) -> dict[str, str]:
    """작업 폴더 경로를 변경"""
    import os
    if not os.path.isabs(body.path):
        return {"error": "절대 경로를 입력해주세요", "path": "", "status": "error"}
    real = os.path.realpath(body.path)
    if not os.access(os.path.dirname(real), os.W_OK):
        return {"error": "쓰기 권한이 없습니다", "path": "", "status": "error"}
    saved = work_dir.set_work_dir(body.path)
    return {"path": saved, "status": "updated"}


@router.get("/test-connection")
def test_connection() -> ConnectionTestResponse:
    try:
        base_url: str = MIDAS.MIDAS_API_BASEURL.get_url()
        key: str = MIDAS.MIDAS_API_KEY.get_key()
        if not base_url or not key:
            return ConnectionTestResponse(
                connected=False,
                message="Base URL 또는 API Key가 설정되지 않았습니다.",
            )
    except (Exception, SystemExit):
        return ConnectionTestResponse(
            connected=False,
            message="Base URL 또는 API Key가 설정되지 않았습니다.",
        )

    try:
        result: dict = MIDAS.MidasAPI("GET", "/db/STOR")
        if isinstance(result, dict) and "error" in str(result).lower():
            return ConnectionTestResponse(connected=False, message=str(result))
        return ConnectionTestResponse(connected=True, message="MIDAS GEN NX 연결 성공")
    except MidasAuthExpiredError as e:
        # 401/404 — 좀비 세션/키 만료 안내 메시지를 그대로 전달
        return ConnectionTestResponse(connected=False, message=str(e))
    except ConnectionError as e:
        return ConnectionTestResponse(
            connected=False,
            message=f"MIDAS 서버에 연결할 수 없습니다. Base URL을 확인하세요. ({e})",
        )
    except TimeoutError as e:
        return ConnectionTestResponse(connected=False, message=str(e))
    except Exception as e:
        return ConnectionTestResponse(connected=False, message=str(e))
