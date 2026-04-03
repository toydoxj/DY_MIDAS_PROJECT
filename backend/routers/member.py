import logging
from collections import defaultdict

from fastapi import APIRouter
import MIDAS_API as MIDAS

from exceptions import MidasApiError, MidasNotFoundError
from models.member import (
    SectionInfo,
    SectionDetailResponse,
    BeamForceMaxRequest,
    BeamForceMaxRow,
    BeamForceMemberRow,
)
from typing import Union

router = APIRouter()
logger = logging.getLogger(__name__)


def _fetch_section_element_map() -> tuple[dict[str, dict], dict[str, list[int]]]:
    """SECT와 ELEM 데이터를 조회하여 Section별 Element 매핑을 반환한다.

    sectionDB/elementDB 캐시가 있으면 재사용한다.
    """
    try:
        sect_raw: dict = MIDAS.sectionDB.ensure_loaded()
    except Exception as e:
        logger.error("SECT 조회 실패: %s", e)
        raise MidasApiError("SECT 조회 실패", cause=str(e))

    try:
        elem_raw: dict = MIDAS.elementDB.ensure_loaded()
    except Exception as e:
        logger.error("ELEM 조회 실패: %s", e)
        raise MidasApiError("ELEM 조회 실패", cause=str(e))

    sections: dict[str, dict] = {}
    sect_data: dict = sect_raw.get("SECT", {})
    for sect_id, sect_info in sect_data.items():
        if not isinstance(sect_info, dict):
            continue
        sect_before: dict = sect_info.get("SECT_BEFORE", {})
        sections[str(sect_id)] = {
            "id": int(sect_id),
            "name": sect_info.get("SECT_NAME", ""),
            "type": sect_before.get("SHAPE", "") if isinstance(sect_before, dict) else "",
        }

    sect_elements: dict[str, list[int]] = defaultdict(list)
    elem_data: dict = elem_raw.get("ELEM", {})
    for elem_id, elem_info in elem_data.items():
        if not isinstance(elem_info, dict):
            continue
        elem_sect: str = str(elem_info.get("SECT", ""))
        if elem_sect in sections:
            sect_elements[elem_sect].append(int(elem_id))

    for keys in sect_elements.values():
        keys.sort()

    return sections, sect_elements


# ---------- 컬럼명 매핑 헬퍼 ----------
_COL_MAP = {
    "My(-)_I": "My_neg_I", "My(-)_I_LC": "My_neg_I_LC",
    "My(-)_C": "My_neg_C", "My(-)_C_LC": "My_neg_C_LC",
    "My(-)_J": "My_neg_J", "My(-)_J_LC": "My_neg_J_LC",
    "My(+)_I": "My_pos_I", "My(+)_I_LC": "My_pos_I_LC",
    "My(+)_C": "My_pos_C", "My(+)_C_LC": "My_pos_C_LC",
    "My(+)_J": "My_pos_J", "My(+)_J_LC": "My_pos_J_LC",
}


# ===== Section 목록 =====

@router.get("/member/sections")
def get_sections() -> list[SectionInfo]:
    """전체 Section 목록과 각 Section에 속한 Element 번호를 반환한다."""
    sections, sect_elements = _fetch_section_element_map()

    result: list[SectionInfo] = []
    for sect_id, info in sections.items():
        keys: list[int] = sect_elements.get(sect_id, [])
        result.append(SectionInfo(
            id=info["id"],
            name=info["name"],
            type=info["type"],
            element_count=len(keys),
            element_keys=keys,
        ))

    result.sort(key=lambda r: r.id)
    return result


# ===== 단면별 최대 부재력 =====

@router.post("/member/beam-force-max")
def get_beam_force_max(req: BeamForceMaxRequest) -> list[Union[BeamForceMaxRow, BeamForceMemberRow]]:
    """최대 부재력을 추출한다. group_by="section"이면 단면별, "member"이면 부재별."""
    if not req.element_keys and not req.section_names:
        return []

    try:
        if req.force_refresh:
            MIDAS.sectionDB.get()
            MIDAS.elementDB.get()
            MIDAS.beamForceDB.get(keys=None)  # 전체 재조회
        else:
            MIDAS.sectionDB.ensure_loaded()
            MIDAS.elementDB.ensure_loaded()
            MIDAS.beamForceDB.ensure_loaded_all()  # 전체 캐시 사용
        df = MIDAS.beamForceDB.to_max_dataframe(
            group_by=req.group_by,
            section_names=req.section_names if req.section_names else None,
            element_keys=req.element_keys if req.element_keys else None,
        )
    except Exception as e:
        logger.error("설계 부재력 조회 실패: %s", e)
        raise MidasApiError("설계 부재력 조회 실패", cause=str(e))

    if df.empty:
        return []

    df.rename(columns=_COL_MAP, inplace=True)

    # 불필요 컬럼 제거
    memb_cols = [c for c in df.columns if c.endswith("_Memb")]
    df.drop(columns=memb_cols, inplace=True, errors="ignore")

    if req.group_by == "member":
        drop_cols = ["SectName", "SectShape", "B", "H", "D"]
        df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True, errors="ignore")
        return [BeamForceMemberRow(**row) for row in df.to_dict(orient="records")]

    return [BeamForceMaxRow(**row) for row in df.to_dict(orient="records")]


# ===== Section 상세 (path parameter — 반드시 마지막에 배치) =====

@router.get("/member/sections/{sect_id}")
def get_section_elements(sect_id: int) -> SectionDetailResponse:
    """특정 Section에 속한 Element 번호 목록을 반환한다."""
    sections, sect_elements = _fetch_section_element_map()

    sect_key: str = str(sect_id)
    if sect_key not in sections:
        raise MidasNotFoundError(f"Section {sect_id}을(를) 찾을 수 없습니다")

    info: dict = sections[sect_key]
    keys: list[int] = sect_elements.get(sect_key, [])
    return SectionDetailResponse(
        id=info["id"],
        name=info["name"],
        type=info["type"],
        element_keys=keys,
    )
