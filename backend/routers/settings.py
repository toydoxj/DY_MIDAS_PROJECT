from fastapi import APIRouter
import MIDAS_API as MIDAS

router = APIRouter()


@router.get("/settings")
def get_settings():
    try:
        base_url = MIDAS.MIDAS_API_BASEURL.get_url()
    except AttributeError:
        base_url = ""
    try:
        key = MIDAS.MIDAS_API_KEY.get_key()
        masked = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    except AttributeError:
        masked = ""
    return {"base_url": base_url, "api_key_masked": masked}


@router.post("/settings")
def update_settings(body: dict):
    if body.get("base_url"):
        MIDAS.MIDAS_API_BASEURL(body["base_url"])
    if body.get("api_key"):
        MIDAS.MIDAS_API_KEY(body["api_key"])
    return {"status": "updated"}


@router.get("/test-connection")
def test_connection():
    try:
        base_url = MIDAS.MIDAS_API_BASEURL.get_url()
        key = MIDAS.MIDAS_API_KEY.get_key()
        if not base_url or not key:
            return {"connected": False, "message": "Base URL 또는 API Key가 설정되지 않았습니다."}
    except AttributeError:
        return {"connected": False, "message": "Base URL 또는 API Key가 설정되지 않았습니다."}

    try:
        result = MIDAS.MidasAPI("GET", "/db/STOR")
        if isinstance(result, dict) and "error" in str(result).lower():
            return {"connected": False, "message": str(result)}
        return {"connected": True, "message": "MIDAS GEN NX 연결 성공"}
    except Exception as e:
        return {"connected": False, "message": str(e)}
