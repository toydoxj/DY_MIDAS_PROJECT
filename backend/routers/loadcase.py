from fastapi import APIRouter, HTTPException, Body
from typing import List
import MIDAS_API as MIDAS

router = APIRouter()


@router.get("/loadcase")
def get_loadcase():
    """MIDAS GEN NX에서 Static Load Case 목록을 가져와 반환"""
    try:
        raw = MIDAS.loadCaseDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    stld = raw.get("STLD", {})
    rows = []
    for key, val in stld.items():
        if isinstance(val, dict):
            rows.append({
                "id": key,
                "NAME": val.get("NAME", ""),
                "TYPE": val.get("TYPE", ""),
                "DESC": val.get("DESC", ""),
            })
    # NO 기준 정렬
    rows.sort(key=lambda r: int(r["id"]))
    return rows


@router.put("/loadcase")
def sync_loadcase(body: List[dict] = Body(...)):
    """프론트엔드에서 수정한 Load Case 데이터를 MIDAS GEN NX로 전송 (추가/수정 포함)"""
    try:
        # 최신 데이터를 먼저 가져와서 구조 유지
        raw = MIDAS.loadCaseDB.get()
        old_stld = raw.get("STLD", {})

        # 프론트엔드에서 받은 ID 목록
        new_ids = {str(item["id"]) for item in body}

        # 삭제된 항목: MIDAS에는 있지만 프론트엔드에는 없는 ID
        deleted_ids = [k for k in old_stld if k not in new_ids and isinstance(old_stld[k], dict)]
        for del_id in deleted_ids:
            MIDAS.MidasAPI("DELETE", f"/db/STLD/{del_id}")

        # 추가/수정 항목 전송
        new_stld = {}
        for item in body:
            key = str(item["id"])
            new_stld[key] = {
                "NO": int(item["id"]),
                "NAME": item["NAME"],
                "TYPE": item["TYPE"],
                "DESC": item["DESC"],
            }

        MIDAS.loadCaseDB._data["STLD"] = new_stld
        MIDAS.loadCaseDB.sync()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")
    return {"status": "synced"}
