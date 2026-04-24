"""슬래브 경간 자동 분석 라우터.

엔드포인트:
    GET  /api/member/slab-span/stories      — MIDAS 층(/db/STOR) 목록
    POST /api/member/slab-span/analyze       — 선택 층 분석
    POST /api/member/slab-span/analyze-all   — 전체 층 분석
"""

from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, Body

import MIDAS_API as MIDAS

import work_dir
from exceptions import MidasApiError
from models.slab_span import (
    BeamSegmentOut,
    FloorLoadBreakdownItem,
    LevelReportOut,
    PanelOut,
    SlabSectionItem,
    SlabSpanAnalyzeRequest,
    SlabSpanAnalyzeResponse,
    SlabSpanSnapshotFull,
    SlabSpanSnapshotListItem,
    SlabSpanSnapshotSaveRequest,
    StoryOut,
)
from exceptions import MidasNotFoundError

router = APIRouter()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# 내부 헬퍼
# ──────────────────────────────────────────────────────────────

def _fetch_story_list() -> list[StoryOut]:
    """MIDAS /db/STOR → 층 이름/레벨 목록."""
    try:
        resp: dict = MIDAS.MidasAPI("GET", "/db/STOR")
    except Exception as e:
        logger.error("STOR 조회 실패: %s", e)
        raise MidasApiError("STOR 조회 실패", cause=str(e))

    stor = resp.get("STOR", {}) if isinstance(resp, dict) else {}
    stories: list[StoryOut] = []
    for sid, v in stor.items():
        if not isinstance(v, dict):
            continue
        stories.append(StoryOut(
            name=str(v.get("STORY_NAME", sid)),
            level=float(v.get("STORY_LEVEL", 0.0)),
            height=float(v.get("STORY_HEIGHT", 0.0)),
        ))
    stories.sort(key=lambda s: s.level)
    return stories


def _load_nodes_and_elems(
    *,
    exclude_section_prefixes: list[str] | None = None,
) -> tuple[dict, list[dict]]:
    """MIDAS /db/NODE + /db/ELEM 조회 → 엔진 입력 형태로 정규화.

    Args:
        exclude_section_prefixes: 이 prefix 로 시작하는 단면명(SECT_NAME)을 가진
            보는 분석에서 제외. 대소문자 무시. 공백/빈 문자열은 자동 무시.
    """
    from engines.slab_span import Node

    try:
        node_raw: dict = MIDAS.nodeDB.ensure_loaded()
    except Exception as e:
        logger.error("NODE 조회 실패: %s", e)
        raise MidasApiError("NODE 조회 실패", cause=str(e))

    try:
        elem_raw: dict = MIDAS.elementDB.ensure_loaded()
    except Exception as e:
        logger.error("ELEM 조회 실패: %s", e)
        raise MidasApiError("ELEM 조회 실패", cause=str(e))

    # 제외 대상 단면 ID 집합 구성 (SECT_NAME prefix 매칭)
    exclude_sect_ids: set[int] = set()
    prefixes_norm: list[str] = [
        p.strip().lower()
        for p in (exclude_section_prefixes or [])
        if p and p.strip()
    ]
    if prefixes_norm:
        try:
            sect_info = MIDAS.sectionDB.info()
        except Exception as e:
            logger.error("SECT 조회 실패 (제외 필터): %s", e)
            raise MidasApiError("SECT 조회 실패", cause=str(e))
        for sid_str, info in sect_info.items():
            name_lc = str(info.get("name", "")).lower()
            if any(name_lc.startswith(p) for p in prefixes_norm):
                try:
                    exclude_sect_ids.add(int(sid_str))
                except (TypeError, ValueError):
                    continue

    nodes_src: dict = node_raw.get("NODE", {})
    nodes: dict[int, Node] = {}
    for nid, v in nodes_src.items():
        if not isinstance(v, dict):
            continue
        try:
            nodes[int(nid)] = Node(
                id=int(nid),
                x=float(v.get("X", 0.0)),
                y=float(v.get("Y", 0.0)),
                z=float(v.get("Z", 0.0)),
            )
        except (TypeError, ValueError):
            continue

    elems_src: dict = elem_raw.get("ELEM", {})
    elems: list[dict] = []
    for eid, v in elems_src.items():
        if not isinstance(v, dict):
            continue
        node_list = v.get("NODE", [])
        if len(node_list) < 2:
            continue
        try:
            sect_id = int(v.get("SECT", 0))
        except (TypeError, ValueError):
            sect_id = 0
        if sect_id in exclude_sect_ids:
            continue
        try:
            elems.append({
                "id": int(eid),
                "type": str(v.get("TYPE", "")).upper(),
                "node_i": int(node_list[0]),
                "node_j": int(node_list[1]),
            })
        except (TypeError, ValueError):
            continue

    return nodes, elems


def _segment_xy(s) -> tuple[float, float, float, float]:
    """BeamSegment → 시각화용 (x1, y1, x2, y2) 좌표."""
    if s.direction == "X":
        return (s.axis_min, s.cross_pos, s.axis_max, s.cross_pos)
    return (s.cross_pos, s.axis_min, s.cross_pos, s.axis_max)


# ──────────────────────────────────────────────────────────────
# Floor Load 조회 + FloorLoadArea 변환
# ──────────────────────────────────────────────────────────────

def _extract_fbld_loads(fbld_raw: dict) -> dict[str, tuple[float, float, int]]:
    """/db/FBLD → {NAME: (DL, LL, fbld_id)} 매핑.

    LCNAME 으로 D(Dead) / L(Live) 를 구분하기 어려우면 /db/STLD 에서 조회한
    loadCase TYPE 을 참조. 현재는 loadCase 인덱스를 router 호출부에서 전달.
    """
    # 이 함수는 shell 만 제공 — 실제 DL/LL 분리는 _classify_dl_ll 로 위임
    return {}


def _unwrap(raw: dict, key: str) -> dict:
    """MIDAS GEN NX 응답의 이중 래핑을 해제.

    실제 응답이 `{"FBLA": {"FBLA": {"1": {...}}}}` 형태로 두 번 감싸져 오는 경우가 있다.
    이 헬퍼는 한 번 더 벗겨 내부 records dict 를 반환. 단일 래핑이면 그대로 반환.
    """
    inner = raw.get(key, {}) if isinstance(raw, dict) else {}
    if (
        isinstance(inner, dict)
        and key in inner
        and isinstance(inner[key], dict)
    ):
        return inner[key]
    return inner if isinstance(inner, dict) else {}


def _classify_dl_ll(
    items: list[dict],
    dead_lc_names: set[str],
    live_lc_names: set[str],
) -> tuple[float, float]:
    """FBLD ITEM 리스트를 DL / LL 로 분리. 부호는 절댓값.

    우선순위:
      1) STLD 의 TYPE=D/L 에서 얻은 이름 집합과 정확 매칭
      2) 약어 정확 일치: "DL" → Dead, "LL" → Live
      3) 키워드 포함: "DEAD"/"SELF" → Dead, "LIVE" → Live
      4) 접두사 fallback: "D" → Dead, "L" → Live
      5) 알 수 없는 경우 보수적으로 Dead 로 합산
    """
    dl = 0.0
    ll = 0.0
    for it in items:
        if not isinstance(it, dict):
            continue
        lc = str(it.get("LCNAME", ""))
        val = abs(float(it.get("FLOOR_LOAD", 0.0) or 0.0))
        lc_upper = lc.upper()

        if lc in dead_lc_names:
            dl += val
        elif lc in live_lc_names:
            ll += val
        elif lc_upper == "DL" or "DEAD" in lc_upper or "SELF" in lc_upper:
            dl += val
        elif lc_upper == "LL" or "LIVE" in lc_upper:
            ll += val
        elif lc_upper.startswith("D"):
            dl += val
        elif lc_upper.startswith("L"):
            ll += val
        else:
            dl += val
    return dl, ll


def _load_case_types() -> tuple[set[str], set[str]]:
    """loadCaseDB 에서 Dead/Live 이름 집합 구성."""
    dead: set[str] = set()
    live: set[str] = set()
    try:
        raw = MIDAS.loadCaseDB.get()
        stld = raw.get("STLD", {}) if isinstance(raw, dict) else {}
        for v in stld.values():
            if not isinstance(v, dict):
                continue
            name = str(v.get("NAME", ""))
            t = str(v.get("TYPE", "")).upper()
            if not name:
                continue
            if t == "D":
                dead.add(name)
            elif t == "L":
                live.add(name)
    except Exception as e:
        logger.warning("loadCase 조회 실패 (DL/LL 분류 영향): %s", e)
    return dead, live


def _fetch_floor_load_areas(
    nodes: dict,
    dead_names: set[str],
    live_names: set[str],
) -> list:
    """/db/FBLA + /db/FBLD 조회 → FloorLoadArea 리스트."""
    from engines.slab_span import FloorLoadArea, Node

    try:
        fbla_raw: dict = MIDAS.floorLoadAssignDB.get()
    except Exception as e:
        logger.warning("FBLA 조회 실패 (Floor Load 매칭 건너뜀): %s", e)
        return []

    try:
        fbld_raw: dict = MIDAS.floorLoadDB.get()
    except Exception as e:
        logger.warning("FBLD 조회 실패 (Floor Load 매칭 건너뜀): %s", e)
        return []

    # FBLD NAME → (DL, LL) 매핑 (이중 래핑 해제)
    name_to_loads: dict[str, tuple[float, float]] = {}
    id_to_name: dict[str, str] = {}
    fbld_map: dict = _unwrap(fbld_raw, "FBLD")
    for fid, v in fbld_map.items():
        if not isinstance(v, dict):
            continue
        name = str(v.get("NAME", ""))
        if not name:
            continue
        items = v.get("ITEM", []) or []
        dl, ll = _classify_dl_ll(items, dead_names, live_names)
        name_to_loads[name] = (dl, ll)
        id_to_name[str(fid)] = name

    # FBLA 처리 (이중 래핑 해제)
    fbla_map: dict = _unwrap(fbla_raw, "FBLA")
    areas: list[FloorLoadArea] = []

    # 여러 가능한 필드명을 방어적으로 시도 (MIDAS GEN NX 는 FLOOR_LOAD_TYPE_NAME 사용)
    name_fields = (
        "FLOOR_LOAD_TYPE_NAME",
        "FBLD_NAME", "FBLD", "FLT_NAME", "LOAD_NAME", "TYPE_NAME", "NAME",
    )
    node_fields = ("NODES", "vNODE", "NODE", "vNODE_LIST", "NODE_LIST")
    id_fields = ("FBLD_NO", "FBLD_ID", "TYPE_NO", "TYPE_ID", "iFBLD")

    for v in fbla_map.values():
        if not isinstance(v, dict):
            continue

        # 1) 참조하는 FBLD NAME 찾기
        fbld_name = ""
        for f in name_fields:
            val = v.get(f)
            if isinstance(val, str) and val:
                fbld_name = val
                break
        if not fbld_name:
            # ID 참조인 경우
            for f in id_fields:
                val = v.get(f)
                if val is not None:
                    fbld_name = id_to_name.get(str(val), "")
                    if fbld_name:
                        break

        dl, ll = name_to_loads.get(fbld_name, (0.0, 0.0))

        # 2) 다각형 노드 리스트 추출
        node_ids: list[int] = []
        for f in node_fields:
            nl = v.get(f)
            if isinstance(nl, list) and nl:
                try:
                    node_ids = [int(x) for x in nl if x is not None]
                    break
                except (TypeError, ValueError):
                    continue
        if len(node_ids) < 3:
            continue

        # 3) 좌표 변환
        poly: list[tuple[float, float]] = []
        zs: list[float] = []
        for nid in node_ids:
            n: Node | None = nodes.get(nid)
            if n is None:
                continue
            poly.append((n.x, n.y))
            zs.append(n.z)
        if len(poly) < 3:
            continue
        z_level = sum(zs) / len(zs)

        areas.append(FloorLoadArea(
            fbld_name=fbld_name,
            polygon=tuple(poly),
            z_level=z_level,
            dl=dl,
            ll=ll,
        ))

    return areas


def _run_analysis(req: SlabSpanAnalyzeRequest) -> SlabSpanAnalyzeResponse:
    from engines.slab_span import (
        analyze_slab_spans,
        build_beam_segments,
        factored_load,
        match_panel_to_loads,
        merge_collinear_beams,
    )

    nodes, elems = _load_nodes_and_elems(
        exclude_section_prefixes=req.exclude_section_prefixes,
    )

    # 층 필터 — story_names 지정 시 /db/STOR 의 레벨로 변환
    target_levels: list[float] | None = None
    name_by_level: dict[float, str] = {}
    stories: list[StoryOut] = []
    try:
        stories = _fetch_story_list()
    except MidasApiError:
        stories = []  # STOR 없어도 자동 감지는 가능

    for s in stories:
        name_by_level[round(s.level, 3)] = s.name

    if req.story_names:
        chosen = {n.strip() for n in req.story_names if n and n.strip()}
        target_levels = [s.level for s in stories if s.name in chosen]
        if not target_levels:
            # 이름을 못 찾으면 빈 결과 반환
            return SlabSpanAnalyzeResponse(level_count=0, total_panels=0, reports=[])

    try:
        reports = analyze_slab_spans(
            nodes, elems,
            z_tol=req.z_tol,
            skew_tol_deg=req.skew_tol_deg,
            pos_tol=req.pos_tol,
            min_span=req.min_span,
            merge_beams=req.merge_beams,
            levels=target_levels,
        )
    except Exception as e:
        logger.error("슬래브 경간 분석 실패: %s", e)
        raise MidasApiError("슬래브 경간 분석 실패", cause=str(e))

    # 시각화용 세그먼트 준비 (층별 필터)
    all_segments = build_beam_segments(
        nodes, elems, z_tol=req.z_tol, skew_tol_deg=req.skew_tol_deg,
    )
    if req.merge_beams:
        all_segments = merge_collinear_beams(all_segments, pos_tol=req.pos_tol)

    # Floor Load 영역 조회 + 매칭
    dead_lc_names, live_lc_names = _load_case_types()
    floor_areas = _fetch_floor_load_areas(nodes, dead_lc_names, live_lc_names)
    matched_count = 0

    out_reports: list[LevelReportOut] = []
    for r in reports:
        story_name = name_by_level.get(round(r.z_level, 3), "")
        beams_at_level = [
            BeamSegmentOut(
                elem_id=s.elem_id,
                direction=s.direction,
                **dict(zip(("x1", "y1", "x2", "y2"), _segment_xy(s))),
            )
            for s in all_segments
            if abs(s.z_level - r.z_level) <= req.z_tol
        ]
        # 사용자에게 보여줄 panel_id 재할당: S-{층이름}-{순번}
        # story_name 이 없으면 z_level 정수 mm 사용. r.panels 는 이미
        # (y_min, x_min) 로 결정적 정렬되어 있으므로 순번이 재현 가능.
        panel_id_label = (
            story_name if story_name
            else f"Z{int(round(r.z_level * 1000))}"
        )

        panels_out: list[PanelOut] = []
        for panel_idx, p in enumerate(r.panels, start=1):
            display_id = f"S-{panel_id_label}-{panel_idx}"
            match_result = (
                match_panel_to_loads(p, floor_areas)
                if floor_areas
                else None
            )
            primary = match_result.primary if match_result else None
            matches = match_result.matches if match_result else ()
            if primary is not None:
                matched_count += 1

            breakdown: list[FloorLoadBreakdownItem] = [
                FloorLoadBreakdownItem(
                    name=a.fbld_name,
                    dl=round(a.dl, 3),
                    ll=round(a.ll, 3),
                    factored=round(factored_load(a), 3),
                    is_primary=(primary is not None and a is primary),
                )
                for a in matches
            ]

            panels_out.append(PanelOut(
                panel_id=display_id,
                z_level=p.z_level,
                story_name=story_name,
                x_min=p.x_min, x_max=p.x_max,
                y_min=p.y_min, y_max=p.y_max,
                lx=p.lx, ly=p.ly,
                short_span=p.short_span,
                long_span=p.long_span,
                aspect_ratio=round(p.aspect_ratio, 3),
                slab_type=p.slab_type,
                area=round(p.area, 3),
                beam_left=p.beam_left,
                beam_right=p.beam_right,
                beam_bottom=p.beam_bottom,
                beam_top=p.beam_top,
                floor_load_name=primary.fbld_name if primary else None,
                floor_load_dl=round(primary.dl, 3) if primary else None,
                floor_load_ll=round(primary.ll, 3) if primary else None,
                floor_load_total=(
                    round(primary.dl + primary.ll, 3) if primary else None
                ),
                floor_load_factored=(
                    round(factored_load(primary), 3) if primary else None
                ),
                floor_load_matches=breakdown,
            ))
        out_reports.append(LevelReportOut(
            z_level=r.z_level,
            story_name=story_name,
            panel_count=r.panel_count,
            one_way_count=r.one_way_count,
            two_way_count=r.two_way_count,
            max_span=round(r.max_span, 3),
            panels=panels_out,
            beams=beams_at_level,
        ))

    return SlabSpanAnalyzeResponse(
        level_count=len(out_reports),
        total_panels=sum(r.panel_count for r in out_reports),
        reports=out_reports,
        floor_load_area_count=len(floor_areas),
        floor_load_matched_count=matched_count,
    )


# ──────────────────────────────────────────────────────────────
# 엔드포인트
# ──────────────────────────────────────────────────────────────

@router.get("/member/slab-span/stories")
def get_stories() -> list[StoryOut]:
    """MIDAS 층 목록을 STORY_LEVEL 오름차순으로 반환."""
    return _fetch_story_list()


@router.post("/member/slab-span/analyze")
def analyze_selected(req: SlabSpanAnalyzeRequest) -> SlabSpanAnalyzeResponse:
    """선택한 층에 대해 슬래브 경간 분석을 수행."""
    return _run_analysis(req)


@router.post("/member/slab-span/analyze-all")
def analyze_all() -> SlabSpanAnalyzeResponse:
    """모든 수평 보가 존재하는 층을 자동 감지하여 분석."""
    return _run_analysis(SlabSpanAnalyzeRequest(story_names=None))


# ──────────────────────────────────────────────────────────────
# 사용자가 직접 지정한 슬래브 이름 저장/로드
# ──────────────────────────────────────────────────────────────

_SLAB_NAMES_FILE = "slab_span_names.json"


def _slab_names_path() -> str:
    return work_dir.get_save_path(_SLAB_NAMES_FILE)


@router.get("/member/slab-span/names")
def get_slab_names() -> dict[str, str]:
    """각 패널 ID 에 사용자가 지정한 슬래브 이름 매핑을 반환."""
    path = _slab_names_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items() if v}
    except Exception as e:
        logger.warning("slab names 파일 읽기 실패: %s", e)
    return {}


@router.put("/member/slab-span/names")
def save_slab_names(body: dict[str, str] = Body(default_factory=dict)) -> dict:
    """전체 이름 매핑을 저장 (panel_id → name)."""
    cleaned = {str(k): str(v).strip() for k, v in body.items() if str(v).strip()}
    path = _slab_names_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)
    return {"status": "saved", "count": len(cleaned)}


# ──────────────────────────────────────────────────────────────
# 슬래브 배근표 (분류 단위)
# ──────────────────────────────────────────────────────────────

_SECTIONS_FILE = "slab_sections.json"


def _sections_path() -> str:
    return work_dir.get_save_path(_SECTIONS_FILE)


def _read_sections() -> list[dict]:
    path = _sections_path()
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            items = data.get("items", [])
            if isinstance(items, list):
                return [i for i in items if isinstance(i, dict)]
    except Exception as e:
        logger.warning("slab sections 파일 읽기 실패: %s", e)
    return []


def _write_sections(items: list[dict]) -> None:
    path = _sections_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "items": items}, f, ensure_ascii=False, indent=2)


@router.get("/member/slab-span/sections")
def get_slab_sections() -> list[SlabSectionItem]:
    """저장된 분류별 두께/TYPE/배근 정보 전체 반환."""
    raw = _read_sections()
    out: list[SlabSectionItem] = []
    for r in raw:
        try:
            out.append(SlabSectionItem.model_validate(r))
        except Exception:
            continue
    return out


@router.put("/member/slab-span/sections")
def save_slab_sections(body: list[SlabSectionItem] = Body(default_factory=list)) -> dict:
    """분류별 배근 정보 전체 덮어쓰기. name 이 비어있는 항목은 무시."""
    cleaned = [item.model_dump() for item in body if item.name.strip()]
    _write_sections(cleaned)
    return {"status": "saved", "count": len(cleaned)}


# ──────────────────────────────────────────────────────────────
# 분석 결과 스냅샷 (이름 기반 다중 저장/불러오기)
# ──────────────────────────────────────────────────────────────

_SNAPSHOTS_FILE = "slab_span_snapshots.json"


def _snapshots_path() -> str:
    return work_dir.get_save_path(_SNAPSHOTS_FILE)


def _read_snapshots() -> dict[str, dict]:
    path = _snapshots_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            snaps = data.get("snapshots", {})
            return snaps if isinstance(snaps, dict) else {}
    except Exception as e:
        logger.warning("snapshots 파일 읽기 실패: %s", e)
    return {}


def _write_snapshots(snapshots: dict[str, dict]) -> None:
    path = _snapshots_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"version": 1, "snapshots": snapshots},
            f, ensure_ascii=False, indent=2,
        )


@router.get("/member/slab-span/snapshots")
def list_snapshots() -> list[SlabSpanSnapshotListItem]:
    """저장된 스냅샷 목록 — 본문 데이터는 제외하고 요약만."""
    snaps = _read_snapshots()
    items: list[SlabSpanSnapshotListItem] = []
    for name, v in snaps.items():
        if not isinstance(v, dict):
            continue
        analysis = v.get("analysis", {}) or {}
        items.append(SlabSpanSnapshotListItem(
            name=name,
            saved_at=str(v.get("saved_at", "")),
            total_panels=int(analysis.get("total_panels", 0) or 0),
            level_count=int(analysis.get("level_count", 0) or 0),
        ))
    items.sort(key=lambda x: x.saved_at, reverse=True)
    return items


@router.get("/member/slab-span/snapshots/{name}")
def load_snapshot(name: str) -> SlabSpanSnapshotFull:
    """이름으로 스냅샷 전체 조회."""
    snaps = _read_snapshots()
    v = snaps.get(name)
    if not isinstance(v, dict):
        raise MidasNotFoundError(f"스냅샷 '{name}'을(를) 찾을 수 없습니다")
    analysis = v.get("analysis") or {}
    names_map = v.get("names") or {}
    sections_raw = v.get("sections") or []
    sections: list[SlabSectionItem] = []
    if isinstance(sections_raw, list):
        for r in sections_raw:
            if isinstance(r, dict):
                try:
                    sections.append(SlabSectionItem.model_validate(r))
                except Exception:
                    continue
    return SlabSpanSnapshotFull(
        name=name,
        saved_at=str(v.get("saved_at", "")),
        analysis=SlabSpanAnalyzeResponse.model_validate(analysis),
        names={str(k): str(v) for k, v in names_map.items() if v},
        sections=sections,
    )


@router.put("/member/slab-span/snapshots/{name}")
def save_snapshot(name: str, body: SlabSpanSnapshotSaveRequest) -> dict:
    """스냅샷 저장 (같은 이름이면 덮어쓰기)."""
    from datetime import datetime
    clean_name = name.strip()
    if not clean_name:
        raise MidasNotFoundError("스냅샷 이름은 비워둘 수 없습니다")
    snaps = _read_snapshots()
    snaps[clean_name] = {
        "saved_at": datetime.now().isoformat(timespec="seconds"),
        "analysis": body.analysis.model_dump(),
        "names": {k: v for k, v in body.names.items() if v},
        "sections": [s.model_dump() for s in body.sections if s.name.strip()],
    }
    _write_snapshots(snaps)
    return {"status": "saved", "name": clean_name}


@router.delete("/member/slab-span/snapshots/{name}")
def delete_snapshot(name: str) -> dict:
    """스냅샷 삭제."""
    snaps = _read_snapshots()
    if name not in snaps:
        raise MidasNotFoundError(f"스냅샷 '{name}'을(를) 찾을 수 없습니다")
    del snaps[name]
    _write_snapshots(snaps)
    return {"status": "deleted", "name": name}


@router.get("/member/slab-span/debug/fbla")
def debug_fbla() -> dict:
    """디버깅: /db/FBLA + /db/FBLD 원시 응답을 그대로 반환.

    FBLA 응답 필드명(노드 리스트/FBLD 참조 방식)이 MIDAS 버전에 따라 다를
    수 있어, 실제 응답 구조 확인 및 매칭 로직 보정에 사용.
    """
    try:
        fbla = MIDAS.floorLoadAssignDB.get()
    except Exception as e:
        logger.error("FBLA 조회 실패: %s", e)
        raise MidasApiError("FBLA 조회 실패", cause=str(e))
    try:
        fbld = MIDAS.floorLoadDB.get()
    except Exception as e:
        logger.error("FBLD 조회 실패: %s", e)
        raise MidasApiError("FBLD 조회 실패", cause=str(e))
    return {"FBLA": fbla, "FBLD": fbld}
