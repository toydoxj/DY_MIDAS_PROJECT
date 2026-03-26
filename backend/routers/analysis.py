from fastapi import APIRouter, HTTPException
import MIDAS_API as MIDAS

from models.analysis import SelfWeightRow, StructureMassResponse, LoadToMassResponse

router = APIRouter()


@router.get("/selfweight")
def get_selfweight() -> list[SelfWeightRow]:
    """MIDAS GEN NX에서 Self-Weight(BODF) 정보를 가져와 반환"""
    try:
        raw: dict = MIDAS.selfWeightDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    bodf: dict = raw.get("BODF", {})
    rows: list[SelfWeightRow] = []
    for key, val in bodf.items():
        if not isinstance(val, dict):
            continue
        fv: list = val.get("FV", [])
        factor: float | None = fv[2] if len(fv) >= 3 else None
        valid: bool = (
            len(fv) == 3
            and fv[0] == 0
            and fv[1] == 0
            and isinstance(fv[2], (int, float))
            and fv[2] < 0
        )
        rows.append(SelfWeightRow(
            id=key,
            LCNAME=val.get("LCNAME", ""),
            GROUP_NAME=val.get("GROUP_NAME", ""),
            FV=fv,
            factor=factor,
            valid=valid,
        ))
    rows.sort(key=lambda r: int(r.id))
    return rows


@router.get("/structure-mass")
def get_structure_mass() -> StructureMassResponse:
    """MIDAS GEN NX에서 Structure Type(STYP) 정보를 가져와 Mass 관련 정보 반환"""
    try:
        raw: dict = MIDAS.structureTypeDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    styp: dict = raw.get("STYP", {})
    data: dict = next((v for v in styp.values() if isinstance(v, dict)), {})

    mass_map: dict[int, str] = {1: "Lumped Mass", 2: "Consistent Mass"}
    smass_map: dict[int, str] = {1: "X,Y,Z", 2: "X,Y", 3: "Z"}

    mass: int | None = data.get("MASS")
    smass: int | None = data.get("SMASS")

    return StructureMassResponse(
        MASS=mass,
        MASS_LABEL=mass_map.get(mass, str(mass) if mass is not None else "-"),
        SMASS=smass,
        SMASS_LABEL=smass_map.get(smass, str(smass) if smass is not None else "-"),
    )


@router.get("/load-to-mass")
def get_load_to_mass() -> LoadToMassResponse:
    """MIDAS GEN NX에서 Loads to Masses(LTOM) 정보를 가져와 반환"""
    try:
        raw: dict = MIDAS.loadToMassDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")

    ltom: dict = raw.get("LTOM", {})
    data: dict = next((v for v in ltom.values() if isinstance(v, dict)), {})

    dir_str: str = data.get("DIR", "")
    return LoadToMassResponse(
        DIR_X="X" in dir_str.upper(),
        DIR_Y="Y" in dir_str.upper(),
        DIR_Z="Z" in dir_str.upper(),
        bNODAL=data.get("bNODAL", False),
        bBEAM=data.get("bBEAM", False),
        bFLOOR=data.get("bFLOOR", False),
        bPRES=data.get("bPRES", False),
        vLC=data.get("vLC", []),
    )
