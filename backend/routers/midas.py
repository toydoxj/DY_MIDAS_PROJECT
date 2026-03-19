from fastapi import APIRouter, HTTPException
from typing import Any
import MIDAS_API as MIDAS

router = APIRouter()


@router.get("/midas/{path:path}")
def get_midas(path: str) -> Any:
    try:
        result = MIDAS.MidasAPI("GET", f"/db/{path}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/midas/{path:path}")
def post_midas(path: str, body: dict = {}) -> Any:
    try:
        result = MIDAS.MidasAPI("POST", f"/db/{path}", body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/midas/{path:path}")
def put_midas(path: str, body: dict = {}) -> Any:
    try:
        result = MIDAS.MidasAPI("PUT", f"/db/{path}", body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/midas/{path:path}")
def delete_midas(path: str) -> Any:
    try:
        result = MIDAS.MidasAPI("DELETE", f"/db/{path}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
