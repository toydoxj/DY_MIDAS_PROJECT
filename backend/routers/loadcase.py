from fastapi import APIRouter, Body
from typing import Any
import MIDAS_API as MIDAS

from exceptions import MidasApiError
from models.loadcase import LoadCaseItem, LoadCaseSyncItem, SPLCItem, SPFCItem
from models.common import StatusResponse

router = APIRouter()


@router.get("/loadcase")
def get_loadcase() -> list[LoadCaseItem]:
    """MIDAS GEN NX에서 Static Load Case 목록을 가져와 반환"""
    try:
        raw: dict = MIDAS.loadCaseDB.get()
    except Exception as e:
        raise MidasApiError("Load Case 조회 실패", cause=str(e))

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
    """프론트엔드에서 수정한 Load Case 데이터를 MIDAS GEN NX로 전송 (추가/수정/삭제 포함)"""
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
        raise MidasApiError("Load Case 동기화 실패", cause=str(e))
    return StatusResponse(status="synced")


@router.get("/splc")
def get_splc() -> list[SPLCItem]:
    """MIDAS GEN NX에서 Response Spectrum Load Case(SPLC) 목록을 가져와 반환"""
    try:
        raw: dict = MIDAS.MidasAPI("GET", "/db/SPLC")
    except Exception as e:
        raise MidasApiError("SPLC 조회 실패", cause=str(e))

    if "error" in raw:
        return []

    splc: dict = raw.get("SPLC", {})
    rows: list[SPLCItem] = []
    for key, val in splc.items():
        if isinstance(val, dict):
            rows.append(SPLCItem(
                id=key,
                NAME=val.get("NAME", ""),
                DIR=val.get("DIR", ""),
                ANGLE=val.get("ANGLE", 0),
                aFUNCNAME=val.get("aFUNCNAME", []),
                COMTYPE=val.get("COMTYPE", ""),
                bADDSIGN=val.get("bADDSIGN", False),
                bACCECC=val.get("bACCECC", False),
            ))
    rows.sort(key=lambda r: int(r.id))
    return rows


@router.get("/spfc")
def get_spfc() -> list[SPFCItem]:
    """MIDAS GEN NX에서 Response Spectrum Function(SPFC) 목록을 가져와 반환"""
    try:
        raw: dict = MIDAS.MidasAPI("GET", "/db/SPFC")
    except Exception as e:
        raise MidasApiError("SPFC 조회 실패", cause=str(e))

    if "error" in raw:
        return []

    spfc: dict = raw.get("SPFC", {})
    rows: list[SPFCItem] = []
    for key, val in spfc.items():
        if not isinstance(val, dict):
            continue
        str_data: dict = val.get("STR", {})
        opt_data: dict = val.get("OPT", {})
        val_data: dict = val.get("VAL", {})
        a_sra: list = val_data.get("aSRA", [0, 0])
        a_scp: list = val_data.get("aSCP", [0, 0])
        sc_val: int = opt_data.get("SC_", -1)

        rows.append(SPFCItem(
            id=key,
            NAME=val.get("NAME", ""),
            SPEC_CODE=str_data.get("SPEC_CODE", ""),
            ZONEFACTOR=val_data.get("ZONEFACTOR", 0),
            SC=sc_val,
            Sds=a_sra[0] if len(a_sra) > 0 else 0,
            Sd1=a_sra[1] if len(a_sra) > 1 else 0,
            Fa=a_scp[0] if len(a_scp) > 0 else 0,
            Fv=a_scp[1] if len(a_scp) > 1 else 0,
            IE=val_data.get("IE", 0),
            R=val_data.get("R_", 0),
            aFUNC=val.get("aFUNC", []),
        ))
    rows.sort(key=lambda r: int(r.id))
    return rows
