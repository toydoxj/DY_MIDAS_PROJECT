"""Slab Span Checker — pytest 테스트.

가상 3×3 그리드 모델로 도메인 로직을 회귀 검증한다.
실행:
    cd backend && ../.venv/Scripts/python -m pytest tests/test_slab_span.py -v
"""

from __future__ import annotations

import os
import sys

import pytest

# backend/ 와 프로젝트 루트를 sys.path 에 추가
# (routers.slab_span 이 import MIDAS_API 를 사용하므로 루트도 필요)
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
for _p in (_BACKEND_DIR, _PROJECT_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from engines.slab_span import (
    FloorLoadArea,
    Node,
    SlabPanel,
    _convex_hull,
    _oriented_min_bbox,
    _polygon_area,
    analyze_slab_spans,
    build_beam_segments,
    classify_direction,
    detect_floor_levels,
    detect_principal_axes,
    find_panels_at_level,
    find_panels_by_faces,
    match_panel_to_loads,
    merge_collinear_beams,
    point_in_polygon,
)
import math


# ──────────────────────────────────────────────────────────────
# Fixtures — 3×3 슬래브 그리드 (X방향 0~18m, Y방향 0~15m)
# ──────────────────────────────────────────────────────────────

@pytest.fixture
def grid_3x3():
    """
    X columns: 0, 6, 12, 18 (m)
    Y rows:    0, 5, 10, 15 (m)
    Z = 3.5 m (2층)
    총 16개 노드, 24개 수평 보(X 12 + Y 12) + 16개 기둥
    → 9개 슬래브 패널 예상
    """
    x_coords = [0.0, 6.0, 12.0, 18.0]
    y_coords = [0.0, 5.0, 10.0, 15.0]
    z = 3.5

    nodes: dict[int, Node] = {}
    nid = 1
    node_at: dict[tuple[float, float], int] = {}
    for y in y_coords:
        for x in x_coords:
            nodes[nid] = Node(id=nid, x=x, y=y, z=z)
            node_at[(x, y)] = nid
            nid += 1

    # 아래층 노드 (기둥용) — 필터링 확인 목적
    base_nid = 100
    col_nid = base_nid
    col_node_at: dict[tuple[float, float], int] = {}
    for y in y_coords:
        for x in x_coords:
            nodes[col_nid] = Node(id=col_nid, x=x, y=y, z=0.0)
            col_node_at[(x, y)] = col_nid
            col_nid += 1

    elems: list[dict] = []
    eid = 1

    # X방향 보
    for y in y_coords:
        for i in range(len(x_coords) - 1):
            elems.append({
                "id": eid, "type": "BEAM",
                "node_i": node_at[(x_coords[i], y)],
                "node_j": node_at[(x_coords[i + 1], y)],
            })
            eid += 1

    # Y방향 보
    for x in x_coords:
        for j in range(len(y_coords) - 1):
            elems.append({
                "id": eid, "type": "BEAM",
                "node_i": node_at[(x, y_coords[j])],
                "node_j": node_at[(x, y_coords[j + 1])],
            })
            eid += 1

    # 기둥 (수직 부재 — 수평부재 필터에서 제외되어야)
    for y in y_coords:
        for x in x_coords:
            elems.append({
                "id": eid, "type": "BEAM",
                "node_i": col_node_at[(x, y)],
                "node_j": node_at[(x, y)],
            })
            eid += 1

    return nodes, elems


# ──────────────────────────────────────────────────────────────
# Unit tests
# ──────────────────────────────────────────────────────────────

def test_classify_direction_x():
    n1 = Node(1, 0, 0, 0)
    n2 = Node(2, 5, 0, 0)
    assert classify_direction(n1, n2) == "X"


def test_classify_direction_y():
    n1 = Node(1, 0, 0, 0)
    n2 = Node(2, 0, 5, 0)
    assert classify_direction(n1, n2) == "Y"


def test_classify_direction_skew():
    n1 = Node(1, 0, 0, 0)
    n2 = Node(2, 3, 3, 0)  # 45도
    assert classify_direction(n1, n2) == "SKEW"


def test_classify_direction_within_tolerance():
    """5도 이내 경사는 X축으로 인정"""
    n1 = Node(1, 0, 0, 0)
    n2 = Node(2, 10, 0.3, 0)  # ≈ 1.72도
    assert classify_direction(n1, n2, skew_tol_deg=5.0) == "X"


def test_build_beam_segments_filters_columns(grid_3x3):
    nodes, elems = grid_3x3
    segments = build_beam_segments(nodes, elems)
    # 수평 보 12 + 12 = 24개만
    assert len(segments) == 24
    assert all(abs(s.z_level - 3.5) < 1e-6 for s in segments)


def test_build_beam_segments_direction_count(grid_3x3):
    nodes, elems = grid_3x3
    segments = build_beam_segments(nodes, elems)
    x_count = sum(1 for s in segments if s.direction == "X")
    y_count = sum(1 for s in segments if s.direction == "Y")
    assert x_count == 12
    assert y_count == 12


def test_find_panels_9_panels(grid_3x3):
    nodes, elems = grid_3x3
    segments = build_beam_segments(nodes, elems)
    panels = find_panels_at_level(segments, z_level=3.5)
    assert len(panels) == 9


def test_panel_spans(grid_3x3):
    nodes, elems = grid_3x3
    segments = build_beam_segments(nodes, elems)
    panels = find_panels_at_level(segments, z_level=3.5)
    for p in panels:
        assert abs(p.lx - 6.0) < 1e-6
        assert abs(p.ly - 5.0) < 1e-6
        assert abs(p.short_span - 5.0) < 1e-6
        assert abs(p.aspect_ratio - 1.2) < 1e-6
        assert p.slab_type == "2방향"


def test_one_way_slab_detection():
    """장단변비 ≥ 2 → 1방향 판정"""
    x_coords = [0.0, 2.0]
    y_coords = [0.0, 6.0]
    nodes: dict[int, Node] = {}
    nid = 1
    node_at: dict[tuple[float, float], int] = {}
    for y in y_coords:
        for x in x_coords:
            nodes[nid] = Node(nid, x, y, 0.0)
            node_at[(x, y)] = nid
            nid += 1

    elems = [
        {"id": 1, "type": "BEAM", "node_i": node_at[(0, 0)], "node_j": node_at[(2, 0)]},
        {"id": 2, "type": "BEAM", "node_i": node_at[(0, 6)], "node_j": node_at[(2, 6)]},
        {"id": 3, "type": "BEAM", "node_i": node_at[(0, 0)], "node_j": node_at[(0, 6)]},
        {"id": 4, "type": "BEAM", "node_i": node_at[(2, 0)], "node_j": node_at[(2, 6)]},
    ]
    segments = build_beam_segments(nodes, elems)
    panels = find_panels_at_level(segments, z_level=0.0)
    assert len(panels) == 1
    assert panels[0].slab_type == "1방향"
    assert abs(panels[0].aspect_ratio - 3.0) < 1e-6


def test_merge_collinear_beams():
    """X방향 0~3m, 3~6m로 분할된 보를 하나로 병합"""
    nodes = {
        1: Node(1, 0, 0, 0),
        2: Node(2, 3, 0, 0),
        3: Node(3, 6, 0, 0),
    }
    elems = [
        {"id": 1, "type": "BEAM", "node_i": 1, "node_j": 2},
        {"id": 2, "type": "BEAM", "node_i": 2, "node_j": 3},
    ]
    segments = build_beam_segments(nodes, elems)
    assert len(segments) == 2
    merged = merge_collinear_beams(segments)
    assert len(merged) == 1
    assert merged[0].axis_min == 0
    assert merged[0].axis_max == 6


def test_split_beams_still_form_panel():
    """분할된 외곽 보로 이뤄진 패널도 병합 후 인식되어야 함"""
    nodes: dict[int, Node] = {}
    x_coords = [0.0, 3.0, 6.0]
    y_coords = [0.0, 2.5, 5.0]
    nid = 1
    node_at: dict[tuple[float, float], int] = {}
    for y in y_coords:
        for x in x_coords:
            nodes[nid] = Node(nid, x, y, 0.0)
            node_at[(x, y)] = nid
            nid += 1

    elems: list[dict] = []
    eid = 1
    # 외곽 4변만, 분할된 상태
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(0, 0)], "node_j": node_at[(3, 0)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(3, 0)], "node_j": node_at[(6, 0)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(0, 5)], "node_j": node_at[(3, 5)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(3, 5)], "node_j": node_at[(6, 5)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(0, 0)], "node_j": node_at[(0, 2.5)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(0, 2.5)], "node_j": node_at[(0, 5)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(6, 0)], "node_j": node_at[(6, 2.5)]}); eid += 1
    elems.append({"id": eid, "type": "BEAM",
                  "node_i": node_at[(6, 2.5)], "node_j": node_at[(6, 5)]}); eid += 1

    segments_raw = build_beam_segments(nodes, elems)
    segments_merged = merge_collinear_beams(segments_raw)
    panels_merged = find_panels_at_level(segments_merged, z_level=0.0)
    assert len(panels_merged) == 1
    assert abs(panels_merged[0].lx - 6.0) < 1e-6
    assert abs(panels_merged[0].ly - 5.0) < 1e-6


def test_analyze_end_to_end(grid_3x3):
    nodes, elems = grid_3x3
    reports = analyze_slab_spans(nodes, elems)
    # 수평 보가 존재하는 Z=3.5 층 하나만
    assert len(reports) == 1
    r = reports[0]
    assert r.panel_count == 9
    assert r.two_way_count == 9
    assert r.one_way_count == 0
    assert abs(r.max_span - 6.0) < 1e-6


def test_detect_floor_levels():
    nodes = {
        1: Node(1, 0, 0, 0.0),
        2: Node(2, 5, 0, 0.0),
        3: Node(3, 0, 0, 3.5),
        4: Node(4, 5, 0, 3.5),
        5: Node(5, 0, 0, 7.0),
    }
    levels = detect_floor_levels(nodes)
    assert levels == [0.0, 3.5, 7.0]


def test_opening_reduces_panel_area():
    """슬래브 내부에 보 추가 시 패널이 세분화되어야 함"""
    # 6×5 패널 중앙에 (3,0)-(3,5) 수직 보 추가 → 3+3 두 패널
    nodes = {
        1: Node(1, 0, 0, 0.0),
        2: Node(2, 3, 0, 0.0),
        3: Node(3, 6, 0, 0.0),
        4: Node(4, 0, 5, 0.0),
        5: Node(5, 3, 5, 0.0),
        6: Node(6, 6, 5, 0.0),
    }
    elems = [
        # 하부
        {"id": 1, "type": "BEAM", "node_i": 1, "node_j": 2},
        {"id": 2, "type": "BEAM", "node_i": 2, "node_j": 3},
        # 상부
        {"id": 3, "type": "BEAM", "node_i": 4, "node_j": 5},
        {"id": 4, "type": "BEAM", "node_i": 5, "node_j": 6},
        # 좌/중/우 수직
        {"id": 5, "type": "BEAM", "node_i": 1, "node_j": 4},
        {"id": 6, "type": "BEAM", "node_i": 2, "node_j": 5},
        {"id": 7, "type": "BEAM", "node_i": 3, "node_j": 6},
    ]
    reports = analyze_slab_spans(nodes, elems, merge_beams=False)
    assert reports[0].panel_count == 2
    for p in reports[0].panels:
        assert abs(p.lx - 3.0) < 1e-6
        assert abs(p.ly - 5.0) < 1e-6


def test_large_panel_with_adjacent_split_panels():
    """큰 패널 옆에 세분화된 작은 패널이 있어도 큰 패널이 인식되어야 한다.

    실제 MIDAS 복잡 평면에서 발견된 패턴:
    좌측 큰 패널 (0~10, 0~10) + 우측 세분화 영역 (10~16, 0~5), (10~16, 5~10)

    X방향 보: y=0, y=5(우측만 10~16), y=10
    Y방향 보: x=0, x=10, x=16(전체), (y=0~5 구간에만 x=13 추가 보)
    """
    xs = [0.0, 10.0, 13.0, 16.0]
    ys = [0.0, 5.0, 10.0]
    nodes: dict[int, Node] = {}
    nid = 1
    node_at: dict[tuple[float, float], int] = {}
    for y in ys:
        for x in xs:
            nodes[nid] = Node(nid, x, y, 0.0)
            node_at[(x, y)] = nid
            nid += 1

    elems: list[dict] = []
    eid = 1

    def add(a, b):
        nonlocal eid
        elems.append({"id": eid, "type": "BEAM",
                      "node_i": node_at[a], "node_j": node_at[b]})
        eid += 1

    # X방향 보
    # y=0: x=0~10, 10~13, 13~16
    add((0.0, 0.0), (10.0, 0.0))
    add((10.0, 0.0), (13.0, 0.0))
    add((13.0, 0.0), (16.0, 0.0))
    # y=5: 우측만 (10~13, 13~16)
    add((10.0, 5.0), (13.0, 5.0))
    add((13.0, 5.0), (16.0, 5.0))
    # y=10: x=0~10, 10~13, 13~16
    add((0.0, 10.0), (10.0, 10.0))
    add((10.0, 10.0), (13.0, 10.0))
    add((13.0, 10.0), (16.0, 10.0))

    # Y방향 보
    # x=0: y=0~10 (분할)
    add((0.0, 0.0), (0.0, 5.0))
    add((0.0, 5.0), (0.0, 10.0))
    # x=10: y=0~10 (분할)
    add((10.0, 0.0), (10.0, 5.0))
    add((10.0, 5.0), (10.0, 10.0))
    # x=13: y=0~5 (작은 패널 분할용, 상부는 없음)
    add((13.0, 0.0), (13.0, 5.0))
    add((13.0, 5.0), (13.0, 10.0))
    # x=16: y=0~10
    add((16.0, 0.0), (16.0, 5.0))
    add((16.0, 5.0), (16.0, 10.0))

    reports = analyze_slab_spans(nodes, elems, merge_beams=True)
    assert len(reports) == 1
    panels = reports[0].panels
    # 기대: 좌측 큰 패널 1개 (10×10) + 우측 4개 작은 패널 (3×5 두 개, 3×5 두 개) = 5개
    sizes = sorted(((p.lx, p.ly) for p in panels))
    assert (10.0, 10.0) in [(round(p.lx, 2), round(p.ly, 2)) for p in panels], \
        f"큰 10×10 패널이 인식되지 않음. 인식 결과: {sizes}"
    # 작은 패널 4개 (3×5)
    small = [p for p in panels if abs(p.lx - 3.0) < 1e-6 and abs(p.ly - 5.0) < 1e-6]
    assert len(small) == 4


def test_point_in_polygon_square():
    poly = ((0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0))
    assert point_in_polygon(5.0, 5.0, poly) is True
    assert point_in_polygon(15.0, 5.0, poly) is False
    assert point_in_polygon(-1.0, -1.0, poly) is False


def test_point_in_polygon_convex():
    # 삼각형
    poly = ((0.0, 0.0), (10.0, 0.0), (5.0, 10.0))
    assert point_in_polygon(5.0, 3.0, poly) is True
    assert point_in_polygon(0.0, 9.0, poly) is False


def test_point_in_polygon_concave_L_shape():
    # L자 형태 (concave)
    poly = ((0.0, 0.0), (10.0, 0.0), (10.0, 4.0), (4.0, 4.0), (4.0, 10.0), (0.0, 10.0))
    assert point_in_polygon(2.0, 2.0, poly) is True   # 하단 좌측 뭉치
    assert point_in_polygon(2.0, 7.0, poly) is True   # 상단 좌측 뭉치
    assert point_in_polygon(7.0, 7.0, poly) is False  # 우상단 L 홈


def _make_panel(panel_id="P1"):
    return SlabPanel(
        panel_id=panel_id, z_level=3.5,
        x_min=0.0, x_max=6.0, y_min=0.0, y_max=5.0,
        lx=6.0, ly=5.0,
        short_span=5.0, long_span=6.0,
        aspect_ratio=1.2, slab_type="2방향", area=30.0,
        beam_left=1, beam_right=2, beam_bottom=3, beam_top=4,
    )


def test_match_panel_to_loads_basic():
    panel = _make_panel()
    areas = [
        FloorLoadArea(
            fbld_name="2F_회의실",
            polygon=((0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)),
            z_level=3.5, dl=2.5, ll=3.0,
        ),
        FloorLoadArea(
            fbld_name="2F_복도",
            polygon=((20.0, 20.0), (30.0, 20.0), (30.0, 30.0), (20.0, 30.0)),
            z_level=3.5, dl=1.0, ll=2.0,
        ),
    ]
    result = match_panel_to_loads(panel, areas)
    assert result.primary is not None
    assert result.primary.fbld_name == "2F_회의실"
    # 먼 영역은 매칭에서 제외
    assert len(result.matches) == 1


def test_match_panel_no_match_returns_empty_result():
    panel = _make_panel()
    areas = [
        FloorLoadArea(
            fbld_name="Far",
            polygon=((100.0, 100.0), (110.0, 100.0), (110.0, 110.0), (100.0, 110.0)),
            z_level=3.5, dl=1.0, ll=2.0,
        ),
    ]
    result = match_panel_to_loads(panel, areas)
    assert result.primary is None
    assert result.matches == ()


def test_match_panel_z_level_mismatch():
    """다른 층 Floor Load 는 매칭되면 안 됨."""
    panel = _make_panel()
    areas = [
        FloorLoadArea(
            fbld_name="1F_회의실",
            polygon=((0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)),
            z_level=0.0, dl=2.5, ll=3.0,
        ),
    ]
    result = match_panel_to_loads(panel, areas, z_tol=0.1)
    assert result.primary is None


def test_match_panel_overlapping_picks_wu_max():
    """겹치는 영역에서는 Wu = 1.2D + 1.6L 가 큰 쪽 선택."""
    panel = _make_panel()
    areas = [
        # Wu = 1.2*1 + 1.6*1 = 2.8
        FloorLoadArea(
            fbld_name="Light",
            polygon=((0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)),
            z_level=3.5, dl=1.0, ll=1.0,
        ),
        # Wu = 1.2*3 + 1.6*5 = 11.6
        FloorLoadArea(
            fbld_name="Heavy",
            polygon=((0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)),
            z_level=3.5, dl=3.0, ll=5.0,
        ),
    ]
    result = match_panel_to_loads(panel, areas)
    assert result.primary is not None
    assert result.primary.fbld_name == "Heavy"
    # 두 영역 모두 matches 에 포함, Wu 내림차순
    assert len(result.matches) == 2
    assert [m.fbld_name for m in result.matches] == ["Heavy", "Light"]


def test_match_panel_wu_beats_sum_for_live_heavy():
    """DL+LL 합은 같아도 Wu 는 LL 가중이므로 LL 많은 쪽이 primary."""
    panel = _make_panel()
    areas = [
        # DL=10, LL=0 → 합 10, Wu = 12.0
        FloorLoadArea(
            fbld_name="MostlyDead",
            polygon=((0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)),
            z_level=3.5, dl=10.0, ll=0.0,
        ),
        # DL=2, LL=8 → 합 10, Wu = 1.2*2 + 1.6*8 = 15.2
        FloorLoadArea(
            fbld_name="MostlyLive",
            polygon=((0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)),
            z_level=3.5, dl=2.0, ll=8.0,
        ),
    ]
    result = match_panel_to_loads(panel, areas)
    assert result.primary is not None
    assert result.primary.fbld_name == "MostlyLive"


def test_factored_load_formula():
    """factored_load 가 정확히 1.2D + 1.6L 을 반환."""
    from engines.slab_span import factored_load
    a = FloorLoadArea(
        fbld_name="T", polygon=((0.0, 0.0),) * 3,
        z_level=0.0, dl=4.9, ll=5.0,
    )
    assert abs(factored_load(a) - (1.2 * 4.9 + 1.6 * 5.0)) < 1e-9


def test_build_beam_segments_includes_skew_by_default():
    """사선 보(45도)는 direction='SKEW'로 포함되어야 한다."""
    nodes = {
        1: Node(1, 0.0, 0.0, 0.0),
        2: Node(2, 5.0, 5.0, 0.0),   # 45도
        3: Node(3, 0.0, 0.0, 0.0),
        4: Node(4, 5.0, 0.0, 0.0),   # X방향
    }
    elems = [
        {"id": 10, "type": "BEAM", "node_i": 1, "node_j": 2},  # SKEW
        {"id": 11, "type": "BEAM", "node_i": 3, "node_j": 4},  # X
    ]
    segs = build_beam_segments(nodes, elems)
    dirs = sorted(s.direction for s in segs)
    assert dirs == ["SKEW", "X"]
    # SKEW 세그먼트의 원본 좌표가 채워져 있어야 함
    skew = next(s for s in segs if s.direction == "SKEW")
    assert (skew.x1, skew.y1, skew.x2, skew.y2) == (0.0, 0.0, 5.0, 5.0)


def test_build_beam_segments_can_exclude_skew():
    nodes = {
        1: Node(1, 0.0, 0.0, 0.0),
        2: Node(2, 5.0, 5.0, 0.0),
    }
    elems = [{"id": 10, "type": "BEAM", "node_i": 1, "node_j": 2}]
    segs = build_beam_segments(nodes, elems, include_skew=False)
    assert segs == []


def test_merge_collinear_skew_beams():
    """같은 직선 위의 사선 보 2개가 merge 후 1개로 합쳐져야 한다.

    현장 사례: MIDAS 가 중간 노드에서 사선 보를 2개 엘레먼트로 쪼개 저장하면
    SVG에서 미세한 틈이 생겨 끊어져 보임. merge_collinear_beams 가 해결.
    """
    nodes = {
        1: Node(1, 0.0, 0.0, 0.0),
        2: Node(2, 3.0, 3.0, 0.0),  # 중간점
        3: Node(3, 5.0, 5.0, 0.0),
    }
    elems = [
        {"id": 10, "type": "BEAM", "node_i": 1, "node_j": 2},
        {"id": 11, "type": "BEAM", "node_i": 2, "node_j": 3},
    ]
    segs = build_beam_segments(nodes, elems)
    skew_before = [s for s in segs if s.direction == "SKEW"]
    assert len(skew_before) == 2

    merged = merge_collinear_beams(segs)
    skew_after = [s for s in merged if s.direction == "SKEW"]
    assert len(skew_after) == 1, f"병합 실패: {len(skew_after)} 개"
    # 병합된 세그먼트의 끝점이 (0,0) ~ (5,5) 에 정확히 일치 (원본 좌표 보존)
    s = skew_after[0]
    endpoints = sorted([(s.x1, s.y1), (s.x2, s.y2)])
    assert abs(endpoints[0][0] - 0.0) < 1e-9
    assert abs(endpoints[0][1] - 0.0) < 1e-9
    assert abs(endpoints[1][0] - 5.0) < 1e-9
    assert abs(endpoints[1][1] - 5.0) < 1e-9


def test_merge_different_line_skews_stay_separate():
    """서로 다른 직선 위의 사선 보는 병합되지 않아야 한다."""
    nodes = {
        1: Node(1, 0.0, 0.0, 0.0),
        2: Node(2, 3.0, 3.0, 0.0),
        3: Node(3, 0.0, 5.0, 0.0),
        4: Node(4, 3.0, 2.0, 0.0),  # 다른 직선
    }
    elems = [
        {"id": 10, "type": "BEAM", "node_i": 1, "node_j": 2},
        {"id": 11, "type": "BEAM", "node_i": 3, "node_j": 4},
    ]
    segs = build_beam_segments(nodes, elems)
    merged = merge_collinear_beams(segs)
    skew_after = [s for s in merged if s.direction == "SKEW"]
    assert len(skew_after) == 2


def test_find_panels_ignores_skew_beams(grid_3x3):
    """사선 보가 추가되어도 패널 탐색 결과는 영향 없음."""
    nodes, elems = grid_3x3
    # 아무 곳에 사선 보 하나 추가
    max_id = max(e["id"] for e in elems) + 1
    nodes[9999] = Node(9999, 100.0, 100.0, 3.5)
    nodes[9998] = Node(9998, 110.0, 105.0, 3.5)
    elems.append({"id": max_id, "type": "BEAM", "node_i": 9999, "node_j": 9998})
    segs = build_beam_segments(nodes, elems)
    assert any(s.direction == "SKEW" for s in segs)
    panels = find_panels_at_level(segs, z_level=3.5)
    # 기존 9개 패널 그대로
    assert len(panels) == 9


def test_classify_dl_ll_exact_dl_not_misclassified_as_ll():
    """'DL' LCNAME 이 LL 로 오분류되면 안 됨 (startswith('L') 버그 회귀 테스트)."""
    from routers.slab_span import _classify_dl_ll
    items = [
        {"LCNAME": "DL", "FLOOR_LOAD": -4.9},
        {"LCNAME": "LL", "FLOOR_LOAD": -5.0},
    ]
    dl, ll = _classify_dl_ll(items, set(), set())
    assert abs(dl - 4.9) < 1e-9
    assert abs(ll - 5.0) < 1e-9


def test_classify_dl_ll_stld_names_take_priority():
    """STLD 에서 수집된 이름 집합이 fallback 보다 우선 매칭된다."""
    from routers.slab_span import _classify_dl_ll
    items = [
        {"LCNAME": "MyDead", "FLOOR_LOAD": -3.0},
        {"LCNAME": "PublicLoad", "FLOOR_LOAD": -2.0},
    ]
    dl, ll = _classify_dl_ll(items, {"MyDead"}, {"PublicLoad"})
    assert abs(dl - 3.0) < 1e-9
    assert abs(ll - 2.0) < 1e-9


def test_unwrap_double_and_single_nested():
    """MIDAS 응답의 이중 래핑을 벗겨야 레코드 dict 반환."""
    from routers.slab_span import _unwrap
    # 이중 래핑
    assert _unwrap({"FBLA": {"FBLA": {"1": {"X": 1}}}}, "FBLA") == {"1": {"X": 1}}
    # 단일 래핑
    assert _unwrap({"FBLA": {"1": {"X": 1}}}, "FBLA") == {"1": {"X": 1}}
    # 빈 응답
    assert _unwrap({}, "FBLA") == {}
    # None/잘못된 타입
    assert _unwrap({"FBLA": None}, "FBLA") == {}


def test_convex_hull_basic():
    pts = [(0, 0), (5, 0), (5, 3), (0, 3), (2, 1)]  # 내부 점 (2,1)
    hull = _convex_hull(pts)
    assert len(hull) == 4  # 내부 점 제외


def test_ombb_axis_aligned_rectangle():
    pts = [(0.0, 0.0), (6.0, 0.0), (6.0, 4.0), (0.0, 4.0)]
    w, h, angle, verts = _oriented_min_bbox(pts)
    assert abs(w - 4.0) < 1e-6
    assert abs(h - 6.0) < 1e-6
    assert len(verts) == 4


def test_ombb_rotated_square():
    # 실제 6x4 패널, 30도 회전
    theta = math.radians(30.0)
    c, s = math.cos(theta), math.sin(theta)
    def rot(x, y):
        return (c * x - s * y, s * x + c * y)
    pts = [rot(0, 0), rot(6, 0), rot(6, 4), rot(0, 4)]
    w, h, angle, verts = _oriented_min_bbox(pts)
    assert abs(w - 4.0) < 1e-3
    assert abs(h - 6.0) < 1e-3
    # 회전각이 30 또는 -60 근처 (long 축 기준)
    assert min(abs(angle - 30.0), abs(angle + 60.0), abs(angle - 120.0), abs(angle + 150.0)) < 1.0


def test_ombb_triangle():
    # 직각삼각형 (0,0), (6,0), (0,4)
    pts = [(0.0, 0.0), (6.0, 0.0), (0.0, 4.0)]
    w, h, angle, verts = _oriented_min_bbox(pts)
    # 직각삼각형은 OMBB가 두 직각변 크기 = 6x4
    assert abs(max(w, h) - 6.0) < 1e-3
    assert abs(min(w, h) - 4.0) < 1e-3


def test_polygon_area_shoelace():
    # 6x4 사각형
    pts = [(0, 0), (6, 0), (6, 4), (0, 4)]
    assert abs(_polygon_area(pts) - 24.0) < 1e-9
    # 직각삼각형
    tri = [(0, 0), (6, 0), (0, 4)]
    assert abs(_polygon_area(tri) - 12.0) < 1e-9


def test_face_detection_triangular_panel():
    """3변 보로 둘러싸인 삼각형 영역 → 삼각형 패널 1개."""
    nodes = {
        1: Node(1, 0.0, 0.0, 0.0),
        2: Node(2, 6.0, 0.0, 0.0),
        3: Node(3, 0.0, 4.0, 0.0),
    }
    elems = [
        {"id": 1, "type": "BEAM", "node_i": 1, "node_j": 2},
        {"id": 2, "type": "BEAM", "node_i": 2, "node_j": 3},  # 사선
        {"id": 3, "type": "BEAM", "node_i": 3, "node_j": 1},
    ]
    segs = build_beam_segments(nodes, elems)
    panels = find_panels_by_faces(segs, z_level=0.0)
    assert len(panels) == 1
    p = panels[0]
    assert p.vertex_count == 3
    assert abs(p.area - 12.0) < 1e-6


def test_face_detection_rotated_square():
    """30도 회전된 사각형 패널 — 기존 grid 방식은 검출 불가, face 방식은 1개."""
    theta = math.radians(30.0)
    c, s = math.cos(theta), math.sin(theta)
    def rot(x, y):
        return (c * x - s * y, s * x + c * y)
    coords = [rot(0, 0), rot(6, 0), rot(6, 4), rot(0, 4)]
    nodes = {
        i + 1: Node(i + 1, x, y, 0.0)
        for i, (x, y) in enumerate(coords)
    }
    elems = [
        {"id": 1, "type": "BEAM", "node_i": 1, "node_j": 2},
        {"id": 2, "type": "BEAM", "node_i": 2, "node_j": 3},
        {"id": 3, "type": "BEAM", "node_i": 3, "node_j": 4},
        {"id": 4, "type": "BEAM", "node_i": 4, "node_j": 1},
    ]
    segs = build_beam_segments(nodes, elems)
    panels = find_panels_by_faces(segs, z_level=0.0)
    assert len(panels) == 1
    p = panels[0]
    assert p.vertex_count == 4
    # OMBB 가 실제 경간 정확히 복원
    assert abs(p.short_span - 4.0) < 1e-3
    assert abs(p.long_span - 6.0) < 1e-3


def test_face_detection_pentagonal_panel():
    """5변 보로 둘러싸인 오각형 → 오각형 패널 1개."""
    coords = [(0, 0), (6, 0), (8, 3), (4, 6), (-1, 3)]
    nodes = {
        i + 1: Node(i + 1, x, y, 0.0)
        for i, (x, y) in enumerate(coords)
    }
    elems = [
        {"id": i + 1, "type": "BEAM", "node_i": i + 1, "node_j": (i + 1) % 5 + 1}
        for i in range(5)
    ]
    segs = build_beam_segments(nodes, elems)
    panels = find_panels_by_faces(segs, z_level=0.0)
    assert len(panels) == 1
    assert panels[0].vertex_count == 5


def test_merge_axis_beam_preserves_original_tilted_coords():
    """skew_tol_deg 이내 기울어진 보가 X 로 분류되어도 원본 좌표 보존.

    현장 사례: 4.12도 기울기 (Δx=6.6, Δy=0.475) 가 classify_direction(tol=5°)
    에서 X 로 분류 → 이전에는 _axis_seg 가 y 를 cross_pos(평균)로 수평화하여
    렌더 시 수평선으로 나타남 → SVG 에서 인접 보와 틈 발생.
    merge_collinear_beams 가 양 끝 세그먼트의 원본 좌표를 보존해야 함.
    """
    nodes = {
        1: Node(1, 0.0, 0.0, 0.0),
        2: Node(2, 6.6, 0.475, 0.0),   # 4.12도 기울기
    }
    elems = [{"id": 10, "type": "BEAM", "node_i": 1, "node_j": 2}]
    segs = build_beam_segments(nodes, elems)
    # skew_tol_deg=5 (기본) 에서 X 로 분류되어야 함
    assert len(segs) == 1
    assert segs[0].direction == "X"

    merged = merge_collinear_beams(segs)
    assert len(merged) == 1
    m = merged[0]
    # 병합 후 원본 좌표 보존 확인 — 수평화되지 않아야
    endpoints = sorted([(m.x1, m.y1), (m.x2, m.y2)])
    assert abs(endpoints[0][0] - 0.0) < 1e-9
    assert abs(endpoints[0][1] - 0.0) < 1e-9, (
        f"원본 y1=0 이 수평화되어 {endpoints[0][1]} 로 변형됨"
    )
    assert abs(endpoints[1][0] - 6.6) < 1e-9
    assert abs(endpoints[1][1] - 0.475) < 1e-9, (
        f"원본 y2=0.475 가 수평화되어 {endpoints[1][1]} 로 변형됨"
    )


def test_analyze_with_grid_method_preserves_legacy():
    """기존 테스트는 method='grid' 로도 동일 결과."""
    x_coords = [0.0, 6.0, 12.0, 18.0]
    y_coords = [0.0, 5.0, 10.0, 15.0]
    nodes = {}
    nid = 1
    node_at = {}
    for y in y_coords:
        for x in x_coords:
            nodes[nid] = Node(id=nid, x=x, y=y, z=3.5)
            node_at[(x, y)] = nid
            nid += 1
    elems = []
    eid = 1
    for y in y_coords:
        for i in range(len(x_coords) - 1):
            elems.append({"id": eid, "type": "BEAM",
                          "node_i": node_at[(x_coords[i], y)],
                          "node_j": node_at[(x_coords[i + 1], y)]})
            eid += 1
    for x in x_coords:
        for j in range(len(y_coords) - 1):
            elems.append({"id": eid, "type": "BEAM",
                          "node_i": node_at[(x, y_coords[j])],
                          "node_j": node_at[(x, y_coords[j + 1])]})
            eid += 1
    reports = analyze_slab_spans(nodes, elems, method="grid")
    assert reports[0].panel_count == 9


def _make_rotated_grid(angle_deg: float, xs: list[float], ys: list[float]):
    """회전된 직교 그리드 BeamSegment 생성 (테스트용)."""
    import math as _m
    from engines.slab_span import BeamSegment
    rad = _m.radians(angle_deg)
    c, s = _m.cos(rad), _m.sin(rad)
    def rot(x, y):
        return (c * x - s * y, s * x + c * y)
    # X 방향 보 (각 y 라인)
    segs: list[BeamSegment] = []
    eid = 1
    for y in ys:
        x1, y1 = rot(xs[0], y)
        x2, y2 = rot(xs[-1], y)
        segs.append(BeamSegment(
            elem_id=eid, direction="SKEW", z_level=0.0,
            x1=x1, y1=y1, x2=x2, y2=y2,
        ))
        eid += 1
    # Y 방향 보 (각 x 라인)
    for x in xs:
        x1, y1 = rot(x, ys[0])
        x2, y2 = rot(x, ys[-1])
        segs.append(BeamSegment(
            elem_id=eid, direction="SKEW", z_level=0.0,
            x1=x1, y1=y1, x2=x2, y2=y2,
        ))
        eid += 1
    return segs


def test_detect_axes_axis_aligned():
    """축정렬 그리드 (0도) — 주축 0도, X/Y 축렬 offset 정상."""
    segs = _make_rotated_grid(0.0, [0.0, 6.0, 12.0], [0.0, 5.0, 10.0])
    res = detect_principal_axes(segs, pos_tol=0.5)
    assert abs(res["angle_deg"]) < 1.0
    assert len(res["x_offsets"]) == 3
    assert len(res["y_offsets"]) == 3


def test_detect_axes_rotated_30deg():
    """30° 회전 그리드 — 주축 30도, 축렬 3개씩."""
    segs = _make_rotated_grid(30.0, [0.0, 6.0, 12.0], [0.0, 5.0, 10.0])
    res = detect_principal_axes(segs, pos_tol=0.5)
    # 주축 각도 30 근처 (bin 폭 1도)
    assert abs(abs(res["angle_deg"]) - 30.0) < 2.0 or \
           abs(abs(res["angle_deg"]) - 60.0) < 2.0  # 90도 뒤집힘 허용
    assert len(res["x_offsets"]) == 3
    assert len(res["y_offsets"]) == 3


def test_detect_axes_rotated_45deg_orthogonal_pair():
    """45° 회전 — 직교 쌍 최적화가 단일 max bin 방식보다 안정."""
    segs = _make_rotated_grid(45.0, [0.0, 6.0, 12.0], [0.0, 5.0, 10.0])
    res = detect_principal_axes(segs, pos_tol=0.5)
    # 주축 각도 45 또는 -45 (직교는 어느 쪽이든 OK)
    deg = res["angle_deg"]
    assert abs(abs(deg) - 45.0) < 2.0
    assert len(res["x_offsets"]) == 3
    assert len(res["y_offsets"]) == 3


def test_detect_axes_empty_returns_defaults():
    res = detect_principal_axes([], pos_tol=0.5)
    assert res["angle_deg"] == 0.0
    assert res["x_offsets"] == []
    assert res["y_offsets"] == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
