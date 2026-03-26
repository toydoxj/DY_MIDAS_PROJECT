from fastapi import APIRouter, HTTPException
import MIDAS_API as MIDAS

from models.project import ProjectInfo, ProjectUpdateRequest
from models.common import StatusResponse

router = APIRouter()


def _extract_pjcf(raw: dict) -> dict:
    """MIDAS 응답 {"PJCF": {"1": {...}}} 에서 실제 데이터를 꺼냄"""
    pjcf: dict = raw.get("PJCF", {})
    if not pjcf:
        return {}
    return next(iter(pjcf.values()), {})


@router.get("/project")
def get_project() -> ProjectInfo:
    """MIDAS GEN NX에서 프로젝트 정보를 가져와 반환"""
    try:
        raw: dict = MIDAS.projectDB.get()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")
    data: dict = _extract_pjcf(raw)
    return ProjectInfo(
        PROJECT=data.get("PROJECT", ""),
        CLIENT=data.get("CLIENT", ""),
        ADDRESS=data.get("ADDRESS", ""),
        COMMENT=data.get("COMMENT", ""),
    )


@router.put("/project")
def sync_project(body: ProjectUpdateRequest) -> StatusResponse:
    """프론트엔드에서 수정한 값을 MIDAS GEN NX로 전송"""
    try:
        raw: dict = MIDAS.projectDB.get()
        pjcf: dict = raw.get("PJCF", {})
        key: str = next(iter(pjcf), "1")

        for field in ("PROJECT", "CLIENT", "ADDRESS", "COMMENT"):
            value = getattr(body, field, None)
            if value is not None:
                MIDAS.projectDB._data["PJCF"][key][field] = value

        MIDAS.projectDB.sync()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MIDAS API 오류: {e}")
    return StatusResponse(status="synced")
