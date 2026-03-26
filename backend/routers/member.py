import logging
from collections import defaultdict

from fastapi import APIRouter, HTTPException
import MIDAS_API as MIDAS

router = APIRouter()
logger = logging.getLogger(__name__)


def _fetch_section_element_map() -> dict:
    """SECT와 ELEM 데이터를 조회하여 Section별 Element 매핑을 반환한다."""
    try:
        sect_raw = MIDAS.MidasAPI("GET", "/db/SECT")
    except Exception as e:
        logger.error("SECT 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail=f"SECT 조회 실패: {e}")

    try:
        elem_raw = MIDAS.MidasAPI("GET", "/db/ELEM")
    except Exception as e:
        logger.error("ELEM 조회 실패: %s", e)
        raise HTTPException(status_code=502, detail=f"ELEM 조회 실패: {e}")

    # SECT 파싱: { "SECT": { "1": { "SECT_NAME": "...", ... }, ... } }
    sections = {}
    sect_data = sect_raw.get("SECT", {})
    for sect_id, sect_info in sect_data.items():
        if not isinstance(sect_info, dict):
            continue
        sections[str(sect_id)] = {
            "id": int(sect_id),
            "name": sect_info.get("SECT_NAME", ""),
            "type": sect_info.get("SECT_BEFORE", {}).get("SHAPE", "") if isinstance(sect_info.get("SECT_BEFORE"), dict) else "",
        }

    # ELEM 파싱: { "ELEM": { "1": { "SECT": 1, ... }, ... } }
    sect_elements = defaultdict(list)
    elem_data = elem_raw.get("ELEM", {})
    for elem_id, elem_info in elem_data.items():
        if not isinstance(elem_info, dict):
            continue
        elem_sect = str(elem_info.get("SECT", ""))
        if elem_sect in sections:
            sect_elements[elem_sect].append(int(elem_id))

    # 정렬
    for keys in sect_elements.values():
        keys.sort()

    return sections, sect_elements


@router.get("/member/sections")
def get_sections():
    """전체 Section 목록과 각 Section에 속한 Element 번호를 반환한다."""
    sections, sect_elements = _fetch_section_element_map()

    result = []
    for sect_id, info in sections.items():
        keys = sect_elements.get(sect_id, [])
        result.append({
            **info,
            "element_count": len(keys),
            "element_keys": keys,
        })

    result.sort(key=lambda r: r["id"])
    return result


@router.get("/member/sections/{sect_id}")
def get_section_elements(sect_id: int):
    """특정 Section에 속한 Element 번호 목록을 반환한다."""
    sections, sect_elements = _fetch_section_element_map()

    sect_key = str(sect_id)
    if sect_key not in sections:
        raise HTTPException(status_code=404, detail=f"Section {sect_id}을(를) 찾을 수 없습니다")

    info = sections[sect_key]
    keys = sect_elements.get(sect_key, [])
    return {
        **info,
        "element_keys": keys,
    }
