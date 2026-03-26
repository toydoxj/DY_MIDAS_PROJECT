import logging

from fastapi import APIRouter, Body
from typing import Any
import MIDAS_API as MIDAS

from exceptions import MidasApiError

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/midas/{path:path}")
def get_midas(path: str) -> Any:
    try:
        return MIDAS.MidasAPI("GET", f"/{path}")
    except Exception as e:
        logger.error("MIDAS API 오류 [GET /%s]: %s", path, e)
        raise MidasApiError(f"MIDAS API 호출 실패 [GET /{path}]", cause=str(e))


@router.post("/midas/{path:path}")
def post_midas(path: str, body: dict = Body(default={})) -> Any:
    try:
        return MIDAS.MidasAPI("POST", f"/{path}", body)
    except Exception as e:
        logger.error("MIDAS API 오류 [POST /%s]: %s", path, e)
        raise MidasApiError(f"MIDAS API 호출 실패 [POST /{path}]", cause=str(e))


@router.put("/midas/{path:path}")
def put_midas(path: str, body: dict = Body(default={})) -> Any:
    try:
        return MIDAS.MidasAPI("PUT", f"/{path}", body)
    except Exception as e:
        logger.error("MIDAS API 오류 [PUT /%s]: %s", path, e)
        raise MidasApiError(f"MIDAS API 호출 실패 [PUT /{path}]", cause=str(e))


@router.delete("/midas/{path:path}")
def delete_midas(path: str) -> Any:
    try:
        return MIDAS.MidasAPI("DELETE", f"/{path}")
    except Exception as e:
        logger.error("MIDAS API 오류 [DELETE /%s]: %s", path, e)
        raise MidasApiError(f"MIDAS API 호출 실패 [DELETE /{path}]", cause=str(e))
