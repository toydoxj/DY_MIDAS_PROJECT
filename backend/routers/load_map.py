"""Load Map 라우터 — 층별 프레임 + Floor Load 오버레이.

엔드포인트:
    POST /api/loadcase/load-map/analyze        — 선택 층 분석
    POST /api/loadcase/load-map/analyze-all    — 전체 층 자동 분석

slab_span 라우터의 MIDAS 조회/매칭 헬퍼를 재사용해 중복 구현을 피한다.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

import MIDAS_API as MIDAS

from exceptions import MidasApiError
from engines.slab_span import (
    build_beam_segments,
    factored_load,
    merge_collinear_beams,
)
from models.load_map import (
    LoadMapArea,
    LoadMapBeam,
    LoadMapLevel,
    LoadMapRequest,
    LoadMapResponse,
)
from routers.slab_span import (
    _fetch_floor_load_areas,
    _fetch_story_list,
    _load_case_types,
    _load_nodes_and_elems,
    _segment_xy,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _run_load_map(req: LoadMapRequest) -> LoadMapResponse:
    nodes, elems = _load_nodes_and_elems()

    # 층 이름 ↔ Z 매핑 — 실패해도 이름 없이 계속 진행
    try:
        stories = _fetch_story_list()
    except MidasApiError as e:
        logger.warning("load-map: STOR 조회 실패 — 이름 없이 진행: %s", e)
        stories = []
    name_by_level: dict[float, str] = {
        round(s.level, 3): s.name.strip() for s in stories
    }
    by_name = {s.name.strip(): s.level for s in stories}

    # 대상 Z 목록 결정 (이름 trim 정규화)
    target_levels: list[float] | None = None
    if req.story_names:
        chosen = {n.strip() for n in req.story_names if n and n.strip()}
        target_levels = [by_name[n] for n in chosen if n in by_name]
        if not target_levels:
            # 이름 매칭 실패: 자동 감지 모드로 fallback — 조기 리턴하지 않음
            logger.warning(
                "load-map: story_names=%s 가 STOR %s 와 매칭 실패 — 자동 감지로 fallback",
                sorted(chosen), sorted(by_name.keys()),
            )
            target_levels = None

    # 보 세그먼트 구성
    try:
        segments = build_beam_segments(
            nodes, elems, z_tol=req.z_tol, skew_tol_deg=req.skew_tol_deg,
        )
        if req.merge_beams:
            segments = merge_collinear_beams(segments, pos_tol=req.pos_tol)
    except Exception as e:
        logger.error("보 세그먼트 구성 실패: %s", e)
        raise MidasApiError("보 데이터 처리 실패", cause=str(e))

    # Floor Load 영역 조회
    dead_names, live_names = _load_case_types()
    areas = _fetch_floor_load_areas(nodes, dead_names, live_names)

    # 진단 로그 — 각 단계 카운트를 남겨 0 원인 추적 용이
    logger.info(
        "load-map: nodes=%d elems=%d stories=%d segments=%d areas=%d target_levels=%s",
        len(nodes), len(elems), len(stories), len(segments), len(areas),
        target_levels,
    )

    # 분석할 Z 레벨 집합: target_levels 지정 시 그대로, 아니면 세그먼트+영역의 Z 합집합
    if target_levels is None:
        z_set: set[float] = set()
        for s in segments:
            z_set.add(round(s.z_level, 3))
        for a in areas:
            z_set.add(round(a.z_level, 3))
        target_levels = sorted(z_set)

    reports: list[LoadMapLevel] = []
    total_area_count = 0
    # Z 허용오차: 절대값이 큰 모델(mm 단위)도 커버하도록 상대오차도 함께
    for z in sorted(target_levels):
        story_name = name_by_level.get(round(z, 3), "")
        z_match_tol = max(req.z_tol, abs(z) * 1e-4, 0.5)  # 최소 0.5(절대), 상대 1e-4

        level_beams = [
            LoadMapBeam(
                elem_id=s.elem_id,
                direction=s.direction,
                **dict(zip(("x1", "y1", "x2", "y2"), _segment_xy(s))),
            )
            for s in segments
            if abs(s.z_level - z) <= z_match_tol
        ]

        level_areas = [
            LoadMapArea(
                fbld_name=a.fbld_name,
                polygon=[(float(x), float(y)) for (x, y) in a.polygon],
                z_level=a.z_level,
                dl=round(a.dl, 3),
                ll=round(a.ll, 3),
                factored=round(factored_load(a), 3),
            )
            for a in areas
            if abs(a.z_level - z) <= z_match_tol
        ]
        total_area_count += len(level_areas)

        if not level_beams and not level_areas:
            continue

        reports.append(LoadMapLevel(
            z_level=z,
            story_name=story_name,
            beams=level_beams,
            load_areas=level_areas,
        ))

    logger.info("load-map: reports=%d total_areas=%d", len(reports), total_area_count)
    return LoadMapResponse(
        level_count=len(reports),
        total_area_count=total_area_count,
        reports=reports,
    )


@router.post("/loadcase/load-map/analyze")
def analyze_selected(req: LoadMapRequest) -> LoadMapResponse:
    """선택 층만 분석."""
    return _run_load_map(req)


@router.post("/loadcase/load-map/analyze-all")
def analyze_all() -> LoadMapResponse:
    """전체 층 자동 분석 (보/영역이 존재하는 모든 Z)."""
    return _run_load_map(LoadMapRequest(story_names=None))


@router.get("/loadcase/load-map/unit")
def get_midas_unit() -> dict:
    """현재 MIDAS 단위 시스템을 조회 — FORCE/DIST 단위에 따라
    노드 좌표, STORY_LEVEL, FLOOR_LOAD 모두 해석이 달라진다.
    """
    try:
        raw = MIDAS.MidasAPI("GET", "/db/UNIT")
    except Exception as e:
        logger.error("UNIT 조회 실패: %s", e)
        raise MidasApiError("UNIT 조회 실패", cause=str(e))
    return {"raw": raw}


@router.get("/loadcase/load-map/debug")
def debug_load_map() -> dict:
    """각 단계 카운트를 반환 — 빈 응답 원인 추적용."""
    nodes, elems = _load_nodes_and_elems()
    stories: list = []
    try:
        stories = _fetch_story_list()
    except Exception as e:
        logger.warning("debug: STOR 조회 실패: %s", e)
    segs = build_beam_segments(nodes, elems)
    dead, live = _load_case_types()
    areas = _fetch_floor_load_areas(nodes, dead, live)

    # 현재 MIDAS 단위 — FORCE/DIST 로 하중 값 해석 (kN/m² vs N/mm² 등)
    unit_raw: dict = {}
    try:
        unit_raw = MIDAS.MidasAPI("GET", "/db/UNIT") or {}
    except Exception as e:
        logger.warning("debug: UNIT 조회 실패: %s", e)

    # 샘플 영역 하나의 실제 dl/ll/factored 값
    sample_areas = []
    for a in areas[:5]:
        sample_areas.append({
            "fbld_name": a.fbld_name,
            "z_level": a.z_level,
            "dl": a.dl,
            "ll": a.ll,
            "factored": factored_load(a),
            "polygon_first3": [list(p) for p in a.polygon[:3]],
        })

    return {
        "unit": unit_raw,
        "nodes": len(nodes),
        "elems": len(elems),
        "sample_node_z": sorted({round(n.z, 2) for n in list(nodes.values())[:200]}),
        "stories": [
            {"name": repr(s.name), "level": s.level} for s in stories
        ],
        "segments": len(segs),
        "sample_segment_z": sorted({round(s.z_level, 2) for s in segs})[:20],
        "areas": len(areas),
        "sample_area_z": sorted({round(a.z_level, 2) for a in areas})[:20],
        "sample_areas": sample_areas,
        "fbld_names": sorted({a.fbld_name for a in areas}),
        "dead_lc_names": sorted(dead),
        "live_lc_names": sorted(live),
    }
