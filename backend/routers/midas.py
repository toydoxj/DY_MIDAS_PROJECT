import logging

from fastapi import APIRouter, Body, HTTPException
from typing import Any
import MIDAS_API as MIDAS

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/midas/{path:path}")
def get_midas(path: str) -> Any:
    try:
        result = MIDAS.MidasAPI("GET", f"/{path}")
        return result
    except Exception as e:
        logger.error("MIDAS API 오류 [GET /%s]: %s", path, e)
        raise HTTPException(status_code=502, detail="MIDAS API 호출 실패")


@router.post("/midas/{path:path}")
def post_midas(path: str, body: dict = Body(default={})) -> Any:
    try:
        result = MIDAS.MidasAPI("POST", f"/{path}", body)
        return result
    except Exception as e:
        logger.error("MIDAS API 오류 [POST /%s]: %s", path, e)
        raise HTTPException(status_code=502, detail="MIDAS API 호출 실패")


@router.put("/midas/{path:path}")
def put_midas(path: str, body: dict = Body(default={})) -> Any:
    try:
        result = MIDAS.MidasAPI("PUT", f"/{path}", body)
        return result
    except Exception as e:
        logger.error("MIDAS API 오류 [PUT /%s]: %s", path, e)
        raise HTTPException(status_code=502, detail="MIDAS API 호출 실패")


@router.delete("/midas/{path:path}")
def delete_midas(path: str) -> Any:
    try:
        result = MIDAS.MidasAPI("DELETE", f"/{path}")
        return result
    except Exception as e:
        logger.error("MIDAS API 오류 [DELETE /%s]: %s", path, e)
        raise HTTPException(status_code=502, detail="MIDAS API 호출 실패")
