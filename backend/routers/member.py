import json
import logging
import os
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
    BeamDesignCheckRequest,
    PositionCheckResult,
    SaveRebarsRequest,
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
        MIDAS.sectionDB.ensure_loaded()
        MIDAS.elementDB.ensure_loaded()
        if req.force_refresh:
            MIDAS.sectionDB.get()
            MIDAS.elementDB.get()
            MIDAS.beamForceDB.get(keys=None)  # 전체 재조회
        else:
            MIDAS.beamForceDB.ensure_loaded_all()  # 전체 캐시 사용 (비어있으면 자동 로드)
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


@router.post("/member/beam-design-check")
def beam_design_check(req: BeamDesignCheckRequest) -> list[PositionCheckResult]:
    """KDS 41 30 00 기준 RC보 설계 검토"""
    from engines.kds_rc_beam import check_position

    # forces를 section_name으로 인덱싱
    force_map: dict[str, BeamForceMaxRow] = {}
    for f in req.forces:
        force_map[f.SectName] = f

    results: list[PositionCheckResult] = []
    for sec in req.sections:
        force = force_map.get(sec.section_name)
        for rb in sec.rebars:
            pos = rb.position  # "I", "C", "J"

            # 해당 위치의 부재력 매핑
            Mu_neg = 0.0
            Mu_pos = 0.0
            Vu = 0.0
            if force:
                Mu_neg = getattr(force, f"My_neg_{pos}", 0.0)
                Mu_pos = getattr(force, f"My_pos_{pos}", 0.0)
                Vu = getattr(force, f"Fz_{pos}", 0.0)

            pc = check_position(
                section_name=sec.section_name,
                position=pos,
                B=sec.B, H=sec.H, cover=rb.cover,
                fck=sec.fck, fy=sec.fy, fyt=sec.fyt,
                top_dia=rb.top_dia, top_count=rb.top_count,
                bot_dia=rb.bot_dia, bot_count=rb.bot_count,
                stirrup_dia=rb.stirrup_dia, stirrup_legs=rb.stirrup_legs, stirrup_spacing=rb.stirrup_spacing,
                Mu_neg_kNm=Mu_neg, Mu_pos_kNm=Mu_pos, Vu_kN=Vu,
            )

            results.append(PositionCheckResult(
                section_name=pc.section_name,
                position=pc.position,
                neg_Mu_d=pc.flex_neg.Mu_d,
                neg_phi_Mn=pc.flex_neg.phi_Mn,
                neg_flexure_dcr=pc.flex_neg.dcr,
                neg_flexure_ok=pc.flex_neg.ok,
                pos_Mu_d=pc.flex_pos.Mu_d,
                pos_phi_Mn=pc.flex_pos.phi_Mn,
                pos_flexure_dcr=pc.flex_pos.dcr,
                pos_flexure_ok=pc.flex_pos.ok,
                Vu_d=pc.shear.Vu_d,
                phi_Vn=pc.shear.phi_Vn,
                shear_dcr=pc.shear.dcr,
                shear_ok=pc.shear.ok,
                rho=pc.rebar_ratio.rho,
                rho_min=pc.rebar_ratio.rho_min,
                rho_max=pc.rebar_ratio.rho_max,
                rho_min_ok=pc.rebar_ratio.min_ok,
                rho_max_ok=pc.rebar_ratio.max_ok,
                stirrup_spacing=pc.stirrup.spacing,
                stirrup_max_spacing=pc.stirrup.max_spacing,
                stirrup_ok=pc.stirrup.ok,
                all_ok=pc.all_ok,
            ))

    return results


# ===== 배근 데이터 저장/로드 (JSON 파일) =====

_REBARS_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_REBARS_FILE = os.path.join(_REBARS_DIR, "rc_beam_rebars.json")


@router.get("/member/rebars")
def get_rebars() -> dict:
    """저장된 배근 데이터를 로드한다."""
    if not os.path.isfile(_REBARS_FILE):
        return {"version": 1, "savedAt": None, "sections": []}
    try:
        with open(_REBARS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"version": 1, "savedAt": None, "sections": []}


@router.put("/member/rebars")
def save_rebars(body: SaveRebarsRequest) -> dict:
    """배근 데이터를 JSON 파일에 저장한다."""
    os.makedirs(_REBARS_DIR, exist_ok=True)
    with open(_REBARS_FILE, "w", encoding="utf-8") as f:
        json.dump(body.model_dump(), f, ensure_ascii=False, indent=2)
    return {"status": "ok"}
