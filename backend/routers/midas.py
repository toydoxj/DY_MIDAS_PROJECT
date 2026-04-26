import logging
from typing import Any

from fastapi import APIRouter, Body
import MIDAS_API as MIDAS
from MIDAS_API._client import MidasAuthExpiredError

from exceptions import MidasApiError, MidasAuthExpiredError as MidasAuthExpiredHttpError

router = APIRouter()
logger = logging.getLogger(__name__)


def _call(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    """공통 호출 래퍼 — MAPI-Key 만료(401/404)는 별도 예외로 변환해 사용자에게 명확히 전달."""
    try:
        if body is None:
            return MIDAS.MidasAPI(method, f"/{path}")
        return MIDAS.MidasAPI(method, f"/{path}", body)
    except MidasAuthExpiredError as e:
        logger.warning("MAPI-Key 만료 의심 [%s /%s]: %s", method, path, e)
        raise MidasAuthExpiredHttpError(str(e))
    except Exception as e:
        logger.error("MIDAS API 오류 [%s /%s]: %s", method, path, e)
        raise MidasApiError(f"MIDAS API 호출 실패 [{method} /{path}]", cause=str(e))


@router.get("/midas/{path:path}")
def get_midas(path: str) -> Any:
    return _call("GET", path)


@router.post("/midas/{path:path}")
def post_midas(path: str, body: dict[str, Any] = Body(default={})) -> Any:
    return _call("POST", path, body)


@router.put("/midas/{path:path}")
def put_midas(path: str, body: dict[str, Any] = Body(default={})) -> Any:
    return _call("PUT", path, body)


@router.delete("/midas/{path:path}")
def delete_midas(path: str) -> Any:
    return _call("DELETE", path)
