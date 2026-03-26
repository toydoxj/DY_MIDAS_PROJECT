from fastapi import APIRouter
import MIDAS_API as MIDAS

from exceptions import MidasApiError

router = APIRouter()


@router.get("/selfweight")
def get_selfweight():
    """MIDAS GEN NX에서 Self-Weight(BODF) 정보를 가져와 반환"""
    try:
        raw = MIDAS.selfWeightDB.get()
    except Exception as e:
        raise MidasApiError("Self-Weight 조회 실패", cause=str(e))

    bodf = raw.get("BODF", {})
    rows = []
    for key, val in bodf.items():
        if not isinstance(val, dict):
            continue
        fv = val.get("FV", [])
        factor = fv[2] if len(fv) >= 3 else None
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
        raise MidasApiError("Structure Mass 조회 실패", cause=str(e))

    styp = raw.get("STYP", {})
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
        raise MidasApiError("Loads to Masses 조회 실패", cause=str(e))

    ltom = raw.get("LTOM", {})
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
