from fastapi import APIRouter, HTTPException
from typing import Any
import MIDAS_API as MIDAS

from models.loadcase import LoadCaseItem, LoadCaseSyncItem
from models.common import StatusResponse

router = APIRouter()


@router.get("/loadcase")
def get_loadcase() -> list[LoadCaseItem]:
    """MIDAS GEN NX에서 Static Load Case 목록을 가져와 반환"""
    try:
        raw: dict = MIDAS.loadCaseDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    stld: dict = raw.get("STLD", {})
    rows: list[LoadCaseItem] = []
    for key, val in stld.items():
        if isinstance(val, dict):
            rows.append(LoadCaseItem(
                id=key,
                NAME=val.get("NAME", ""),
                TYPE=val.get("TYPE", ""),
                DESC=val.get("DESC", ""),
            ))
    rows.sort(key=lambda r: int(r.id))
    return rows


@router.put("/loadcase")
def sync_loadcase(body: list[LoadCaseSyncItem]) -> StatusResponse:
    """프론트엔드에서 수정한 Load Case 데이터를 MIDAS GEN NX로 전송 (추가/수정 포함)"""
    try:
        raw: dict = MIDAS.loadCaseDB.get()
        old_stld: dict = raw.get("STLD", {})

        new_ids: set[str] = {str(item.id) for item in body}

        deleted_ids: list[str] = [
            k for k in old_stld
            if k not in new_ids and isinstance(old_stld[k], dict)
        ]
        for del_id in deleted_ids:
            MIDAS.MidasAPI("DELETE", f"/db/STLD/{del_id}")

        new_stld: dict[str, Any] = {}
        for item in body:
            key: str = str(item.id)
            new_stld[key] = {
                "NO": int(item.id),
                "NAME": item.NAME,
                "TYPE": item.TYPE,
                "DESC": item.DESC,
            }

        MIDAS.loadCaseDB._data["STLD"] = new_stld
        MIDAS.loadCaseDB.sync()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")
    return StatusResponse(status="synced")
