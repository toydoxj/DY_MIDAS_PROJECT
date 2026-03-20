from fastapi import APIRouter, HTTPException
import MIDAS_API as MIDAS

router = APIRouter()


def _extract_pjcf(raw: dict) -> dict:
    """MIDAS 응답 {"PJCF": {"1": {...}}} 에서 실제 데이터를 꺼냄"""
    pjcf = raw.get("PJCF", {})
    if not pjcf:
        return {}
    return next(iter(pjcf.values()), {})


@router.get("/project")
def get_project():
    """MIDAS GEN NX에서 프로젝트 정보를 가져와 반환"""
    try:
        raw = MIDAS.projectDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")
    data = _extract_pjcf(raw)
    return {
        "PROJECT": data.get("PROJECT", ""),
        "CLIENT":  data.get("CLIENT", ""),
        "ADDRESS": data.get("ADDRESS", ""),
        "COMMENT": data.get("COMMENT", ""),
    }


@router.put("/project")
def sync_project(body: dict):
    """프론트엔드에서 수정한 값을 MIDAS GEN NX로 전송"""
    try:
        # _data가 비어있을 수 있으므로 항상 최신 데이터를 먼저 가져옴
        raw = MIDAS.projectDB.get()
        pjcf = raw.get("PJCF", {})
        key = next(iter(pjcf), "1")

        for field in ("PROJECT", "CLIENT", "ADDRESS", "COMMENT"):
            if field in body:
                MIDAS.projectDB._data["PJCF"][key][field] = body[field]

        MIDAS.projectDB.sync()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")
    return {"status": "synced"}
