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


@router.get("/selfweight")
def get_selfweight():
    """MIDAS GEN NX에서 Self-Weight(BODF) 정보를 가져와 반환"""
    try:
        raw = MIDAS.selfWeightDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    bodf = raw.get("BODF", {})
    rows = []
    for key, val in bodf.items():
        if not isinstance(val, dict):
            continue
        fv = val.get("FV", [])
        # Factor: FV[2] 추출
        factor = fv[2] if len(fv) >= 3 else None
        # 적합 조건: FV == [0, 0, 음수]
        valid = (
            len(fv) == 3
            and fv[0] == 0
            and fv[1] == 0
            and isinstance(fv[2], (int, float))
            and fv[2] < 0
        )
        rows.append({
            "id": key,
            "LCNAME": val.get("LCNAME", ""),
            "GROUP_NAME": val.get("GROUP_NAME", ""),
            "FV": fv,
            "factor": factor,
            "valid": valid,
        })
    rows.sort(key=lambda r: int(r["id"]))
    return rows


@router.get("/structure-mass")
def get_structure_mass():
    """MIDAS GEN NX에서 Structure Type(STYP) 정보를 가져와 Mass 관련 정보 반환"""
    try:
        raw = MIDAS.structureTypeDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    styp = raw.get("STYP", {})
    # STYP는 단일 객체 ({"1": {...}}) 구조
    data = next((v for v in styp.values() if isinstance(v, dict)), {})

    mass_map = {1: "Lumped Mass", 2: "Consistent Mass"}
    smass_map = {1: "X,Y,Z", 2: "X,Y", 3: "Z"}

    return {
        "MASS": data.get("MASS"),
        "MASS_LABEL": mass_map.get(data.get("MASS"), str(data.get("MASS", "-"))),
        "SMASS": data.get("SMASS"),
        "SMASS_LABEL": smass_map.get(data.get("SMASS"), str(data.get("SMASS", "-"))),
    }


@router.get("/load-to-mass")
def get_load_to_mass():
    """MIDAS GEN NX에서 Loads to Masses(LTOM) 정보를 가져와 반환"""
    try:
        raw = MIDAS.loadToMassDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    ltom = raw.get("LTOM", {})
    # LTOM은 단일 객체 ({"1": {...}}) 구조
    data = next((v for v in ltom.values() if isinstance(v, dict)), {})

    dir_str = data.get("DIR", "")
    return {
        "DIR_X": "X" in dir_str.upper(),
        "DIR_Y": "Y" in dir_str.upper(),
        "DIR_Z": "Z" in dir_str.upper(),
        "bNODAL": data.get("bNODAL", False),
        "bBEAM": data.get("bBEAM", False),
        "bFLOOR": data.get("bFLOOR", False),
        "bPRES": data.get("bPRES", False),
        "vLC": data.get("vLC", []),
    }
