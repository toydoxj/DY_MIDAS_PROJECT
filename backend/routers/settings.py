from fastapi import APIRouter
from pydantic import BaseModel
import MIDAS_API as MIDAS

from models.settings import SettingsResponse, SettingsUpdateRequest, ConnectionTestResponse
import work_dir

router = APIRouter()


@router.get("/settings")
def get_settings() -> SettingsResponse:
    try:
        base_url: str = MIDAS.MIDAS_API_BASEURL.get_url()
    except AttributeError:
        base_url = ""
    try:
        key: str = MIDAS.MIDAS_API_KEY.get_key()
        masked: str = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    except AttributeError:
        masked = ""
    return SettingsResponse(base_url=base_url, api_key_masked=masked)


@router.post("/settings")
def update_settings(body: SettingsUpdateRequest) -> dict[str, str]:
    if body.base_url:
        MIDAS.MIDAS_API_BASEURL(body.base_url)
    if body.api_key:
        MIDAS.MIDAS_API_KEY(body.api_key)
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
    except AttributeError:
        return ConnectionTestResponse(
            connected=False,
            message="Base URL 또는 API Key가 설정되지 않았습니다.",
        )

    try:
        result: dict = MIDAS.MidasAPI("GET", "/db/STOR")
        if isinstance(result, dict) and "error" in str(result).lower():
            return ConnectionTestResponse(connected=False, message=str(result))
        return ConnectionTestResponse(connected=True, message="MIDAS GEN NX 연결 성공")
    except Exception as e:
        return ConnectionTestResponse(connected=False, message=str(e))
