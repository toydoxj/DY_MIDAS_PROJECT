"""슬래브 경간(span) 자동 분석 엔진.

순수 함수 + dataclass 기반. I/O 없음.
MIDAS의 노드/엘레먼트 원시 데이터만으로 층별 슬래브 패널을 자동 탐지하고
경간/장단변비/슬래브 유형(1방향/2방향)을 분류한다.

경간 정의: **center-to-center** (보 중심선 간 거리, grid 좌표 차이).
슬래브 유형: [KDS 14 20 70] 4.7 — 장단변비(long/short) ≥ 2.0 → 1방향, 미만 → 2방향.

입력 데이터 제약:
- MIDAS REST `/db/NODE` 응답을 {id: Node} 형태로 정규화.
- MIDAS REST `/db/ELEM` 응답을 [{"id", "type", "node_i", "node_j"}, ...] 로 정규화.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Literal, Sequence


# ──────────────────────────────────────────────────────────────
# Dataclasses (결과 재현성을 위해 frozen=True)
# ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Node:
    id: int
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class BeamSegment:
    """수평 보 1개 (또는 병합된 여러 보)의 축 방향 세그먼트."""
    elem_id: int            # 원본 elem id (병합된 보는 첫 원본 id)
    direction: Literal["X", "Y"]
    z_level: float
    axis_min: float         # direction=X → x_min, Y → y_min
    axis_max: float         # direction=X → x_max, Y → y_max
    cross_pos: float        # direction=X → y 좌표, Y → x 좌표

    @property
    def length(self) -> float:
        return self.axis_max - self.axis_min


@dataclass(frozen=True)
class SlabPanel:
    panel_id: str
    z_level: float
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    lx: float               # x_max - x_min
    ly: float               # y_max - y_min
    short_span: float       # min(lx, ly)
    long_span: float        # max(lx, ly)
    aspect_ratio: float     # long / short
    slab_type: Literal["1방향", "2방향"]
    area: float             # lx * ly
    beam_left: int          # 좌측(X=x_min) 변을 담당하는 Y방향 보 elem_id
    beam_right: int
    beam_bottom: int        # 하부(Y=y_min) 변을 담당하는 X방향 보 elem_id
    beam_top: int


@dataclass(frozen=True)
class SlabSpanReport:
    z_level: float
    panel_count: int
    one_way_count: int
    two_way_count: int
    max_span: float
    panels: list[SlabPanel] = field(default_factory=list)


@dataclass(frozen=True)
class FloorLoadArea:
    """MIDAS /db/FBLA 의 Floor Load Assignment 한 건.

    fbld_name: 참조하는 FBLD 의 NAME (없으면 "")
    polygon:   (x, y) 노드 좌표 시퀀스 (다각형의 꼭짓점)
    z_level:   해당 다각형이 속한 Z 레벨 (노드들 평균)
    dl, ll:    kN/m² 단위. FBLD ITEM 에서 추출. 부호는 양수로 반환.
    """
    fbld_name: str
    polygon: tuple[tuple[float, float], ...]
    z_level: float
    dl: float
    ll: float


@dataclass(frozen=True)
class PanelLoadMatch:
    """패널에 매칭된 Floor Load 요약."""
    panel_id: str
    fbld_name: str
    dl: float       # kN/m²
    ll: float       # kN/m²


@dataclass(frozen=True)
class PanelLoadMatchResult:
    """한 패널에 대한 Floor Load 매칭 결과.

    primary: 대표값 — Wu(=1.2D+1.6L) 기준 최대 매칭. 없으면 None.
    matches: 매칭된 모든 영역. Wu 내림차순 정렬 (primary 가 matches[0]).
    """
    primary: FloorLoadArea | None
    matches: tuple[FloorLoadArea, ...]


# ──────────────────────────────────────────────────────────────
# 방향 분류
# ──────────────────────────────────────────────────────────────

def classify_direction(
    n1: Node,
    n2: Node,
    *,
    skew_tol_deg: float = 5.0,
) -> Literal["X", "Y", "SKEW"]:
    """두 노드의 연결선이 X/Y축 중 어디에 가까운지 반환.

    허용각(skew_tol_deg) 이내면 축 방향으로 인정, 아니면 "SKEW".
    """
    dx = n2.x - n1.x
    dy = n2.y - n1.y
    if dx == 0.0 and dy == 0.0:
        return "SKEW"
    # atan2 결과를 [0, 90] 구간으로 접어서 축과의 편차각 산출
    angle_deg = math.degrees(math.atan2(abs(dy), abs(dx)))
    if angle_deg <= skew_tol_deg:
        return "X"
    if angle_deg >= 90.0 - skew_tol_deg:
        return "Y"
    return "SKEW"


# ──────────────────────────────────────────────────────────────
# 보 세그먼트 추출
# ──────────────────────────────────────────────────────────────

def build_beam_segments(
    nodes: dict[int, Node],
    elems: list[dict],
    *,
    z_tol: float = 0.01,
    skew_tol_deg: float = 5.0,
) -> list[BeamSegment]:
    """엘레먼트 리스트에서 수평 보(TYPE=BEAM + 양단 Z 일치 + X/Y축 정렬)만 필터.

    기둥(수직 부재), 사선보는 제외된다.
    """
    segments: list[BeamSegment] = []
    for e in elems:
        if str(e.get("type", "")).upper() != "BEAM":
            continue
        n1 = nodes.get(e["node_i"])
        n2 = nodes.get(e["node_j"])
        if n1 is None or n2 is None:
            continue
        # 수평부재만 (Z 동일)
        if abs(n1.z - n2.z) > z_tol:
            continue
        direction = classify_direction(n1, n2, skew_tol_deg=skew_tol_deg)
        if direction == "SKEW":
            continue
        z_level = (n1.z + n2.z) / 2.0
        if direction == "X":
            axis_min = min(n1.x, n2.x)
            axis_max = max(n1.x, n2.x)
            cross_pos = (n1.y + n2.y) / 2.0
        else:
            axis_min = min(n1.y, n2.y)
            axis_max = max(n1.y, n2.y)
            cross_pos = (n1.x + n2.x) / 2.0
        segments.append(BeamSegment(
            elem_id=int(e["id"]),
            direction=direction,
            z_level=z_level,
            axis_min=axis_min,
            axis_max=axis_max,
            cross_pos=cross_pos,
        ))
    return segments


# ──────────────────────────────────────────────────────────────
# 분할된 동일 직선 보 병합
# ──────────────────────────────────────────────────────────────

def merge_collinear_beams(
    segments: list[BeamSegment],
    *,
    pos_tol: float = 0.01,
) -> list[BeamSegment]:
    """같은 방향 + 같은 Z + 같은 cross_pos + 맞닿은 끝점 → 하나로 병합.

    구간 겹침 또는 끝점 접촉(≤ pos_tol) 시 연결. 결정적 결과를 위해
    (direction, z, cross_pos, axis_min) 순으로 정렬 후 선형 스위프.
    """
    if not segments:
        return []

    # 그룹 키: (direction, z_level 스냅, cross_pos 스냅)
    def snap(v: float) -> float:
        return round(v / pos_tol) * pos_tol if pos_tol > 0 else v

    buckets: dict[tuple[str, float, float], list[BeamSegment]] = {}
    for s in segments:
        key = (s.direction, snap(s.z_level), snap(s.cross_pos))
        buckets.setdefault(key, []).append(s)

    merged: list[BeamSegment] = []
    for key, group in buckets.items():
        group_sorted = sorted(group, key=lambda s: s.axis_min)
        cur_min = group_sorted[0].axis_min
        cur_max = group_sorted[0].axis_max
        cur_id = group_sorted[0].elem_id
        direction = group_sorted[0].direction
        z_level = group_sorted[0].z_level
        cross_pos = group_sorted[0].cross_pos
        for s in group_sorted[1:]:
            if s.axis_min <= cur_max + pos_tol:
                # 연결 가능 → 확장
                if s.axis_max > cur_max:
                    cur_max = s.axis_max
            else:
                merged.append(BeamSegment(
                    elem_id=cur_id,
                    direction=direction,
                    z_level=z_level,
                    axis_min=cur_min,
                    axis_max=cur_max,
                    cross_pos=cross_pos,
                ))
                cur_min = s.axis_min
                cur_max = s.axis_max
                cur_id = s.elem_id
        merged.append(BeamSegment(
            elem_id=cur_id,
            direction=direction,
            z_level=z_level,
            axis_min=cur_min,
            axis_max=cur_max,
            cross_pos=cross_pos,
        ))
    return merged


# ──────────────────────────────────────────────────────────────
# 패널 탐색
# ──────────────────────────────────────────────────────────────

def _cluster_positions(values: Iterable[float], tol: float) -> list[float]:
    """스냅+정렬하여 근접값 클러스터링한 대표값 리스트."""
    vals = sorted(values)
    if not vals:
        return []
    clusters: list[list[float]] = [[vals[0]]]
    for v in vals[1:]:
        if v - clusters[-1][-1] <= tol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [sum(c) / len(c) for c in clusters]


def _find_covering_beam(
    segments: list[BeamSegment],
    *,
    direction: Literal["X", "Y"],
    cross_pos: float,
    axis_lo: float,
    axis_hi: float,
    pos_tol: float,
) -> int | None:
    """특정 변(cross_pos, axis_lo~axis_hi)을 완전히 덮는 보의 elem_id 반환.

    여러 보로 구성되더라도 union 이 구간을 덮으면 인정 (병합 전 상태 대응).
    """
    # cross_pos 일치하는 세그먼트만 후보로
    candidates = [
        s for s in segments
        if s.direction == direction and abs(s.cross_pos - cross_pos) <= pos_tol
    ]
    if not candidates:
        return None

    # 구간 병합으로 union 커버리지 확인
    intervals = sorted(
        ((s.axis_min, s.axis_max, s.elem_id) for s in candidates),
        key=lambda t: t[0],
    )
    # axis_lo 를 커버하는 첫 구간부터 접속하여 axis_hi 까지 도달 가능?
    current = axis_lo
    covering_id: int | None = None
    for lo, hi, eid in intervals:
        if hi <= current - pos_tol:
            continue
        if lo <= current + pos_tol:
            if covering_id is None:
                covering_id = eid
            if hi >= axis_hi - pos_tol:
                return covering_id
            current = hi
        else:
            # current 와 lo 사이 공백 → 커버 실패
            return None
    return None


def find_panels_at_level(
    segments: list[BeamSegment],
    *,
    z_level: float,
    pos_tol: float = 0.01,
    min_span: float = 0.5,
    z_tol: float = 0.01,
) -> list[SlabPanel]:
    """특정 Z 레벨에서 보로 둘러싸인 사각형 슬래브 패널을 탐색.

    알고리즘 (union-find 기반, 복잡한 불규칙 평면 지원):
    1. X/Y방향 보의 cross_pos 로 (y_grid, x_grid) 를 구성 → 미니 셀 격자.
    2. 인접한 두 미니 셀의 **공통 경계에 보가 없으면** 같은 패널로 union.
       → 큰 패널 내부의 격자 분할이 자동 병합된다.
    3. 병합 후 각 컴포넌트의 bounding box 가
       (a) 직사각형이고  (b) 외곽 4변이 보로 완전히 덮이면 패널로 인정.
    """
    level_segs = [s for s in segments if abs(s.z_level - z_level) <= z_tol]
    x_beams = [s for s in level_segs if s.direction == "X"]
    y_beams = [s for s in level_segs if s.direction == "Y"]

    y_grid = _cluster_positions((s.cross_pos for s in x_beams), pos_tol)
    x_grid = _cluster_positions((s.cross_pos for s in y_beams), pos_tol)
    nx = len(x_grid) - 1
    ny = len(y_grid) - 1
    if nx <= 0 or ny <= 0:
        return []

    def has_x_beam(*, cross_pos: float, axis_lo: float, axis_hi: float) -> int | None:
        return _find_covering_beam(
            x_beams, direction="X", cross_pos=cross_pos,
            axis_lo=axis_lo, axis_hi=axis_hi, pos_tol=pos_tol,
        )

    def has_y_beam(*, cross_pos: float, axis_lo: float, axis_hi: float) -> int | None:
        return _find_covering_beam(
            y_beams, direction="Y", cross_pos=cross_pos,
            axis_lo=axis_lo, axis_hi=axis_hi, pos_tol=pos_tol,
        )

    # ── union-find (셀 (i, k) 단위) ──
    parent = list(range(nx * ny))

    def cid(i: int, k: int) -> int:
        return i * ny + k

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(nx):
        for k in range(ny):
            # 오른쪽 경계 (x = x_grid[i+1], y [y_grid[k], y_grid[k+1]])
            if i + 1 < nx:
                if has_y_beam(
                    cross_pos=x_grid[i + 1],
                    axis_lo=y_grid[k], axis_hi=y_grid[k + 1],
                ) is None:
                    union(cid(i, k), cid(i + 1, k))
            # 상단 경계 (y = y_grid[k+1], x [x_grid[i], x_grid[i+1]])
            if k + 1 < ny:
                if has_x_beam(
                    cross_pos=y_grid[k + 1],
                    axis_lo=x_grid[i], axis_hi=x_grid[i + 1],
                ) is None:
                    union(cid(i, k), cid(i, k + 1))

    # 그룹 수집
    from collections import defaultdict
    groups: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for i in range(nx):
        for k in range(ny):
            groups[find(cid(i, k))].append((i, k))

    panels: list[SlabPanel] = []
    z_idx = int(round(z_level * 1000))

    for cells in groups.values():
        i_vals = [c[0] for c in cells]
        k_vals = [c[1] for c in cells]
        i_min, i_max = min(i_vals), max(i_vals)
        k_min, k_max = min(k_vals), max(k_vals)
        expected = (i_max - i_min + 1) * (k_max - k_min + 1)
        if len(cells) != expected:
            # 비직사각형 그룹 (L자 등) — 현재 MVP에서는 패널로 인식하지 않음
            continue

        x_lo, x_hi = x_grid[i_min], x_grid[i_max + 1]
        y_lo, y_hi = y_grid[k_min], y_grid[k_max + 1]
        lx = x_hi - x_lo
        ly = y_hi - y_lo
        if lx < min_span or ly < min_span:
            continue

        # 외곽 4변 각각이 보로 **완전히** 덮이는지 확인
        beam_bottom = has_x_beam(cross_pos=y_lo, axis_lo=x_lo, axis_hi=x_hi)
        beam_top = has_x_beam(cross_pos=y_hi, axis_lo=x_lo, axis_hi=x_hi)
        beam_left = has_y_beam(cross_pos=x_lo, axis_lo=y_lo, axis_hi=y_hi)
        beam_right = has_y_beam(cross_pos=x_hi, axis_lo=y_lo, axis_hi=y_hi)
        if None in (beam_bottom, beam_top, beam_left, beam_right):
            continue

        short_span = min(lx, ly)
        long_span = max(lx, ly)
        aspect_ratio = long_span / short_span
        # [KDS 14 20 70] 장단변비 ≥ 2.0 → 1방향
        slab_type: Literal["1방향", "2방향"] = "1방향" if aspect_ratio >= 2.0 else "2방향"
        panel_id = f"P{z_idx:+d}-{k_min + 1}-{i_min + 1}"
        panels.append(SlabPanel(
            panel_id=panel_id,
            z_level=z_level,
            x_min=x_lo, x_max=x_hi,
            y_min=y_lo, y_max=y_hi,
            lx=lx, ly=ly,
            short_span=short_span,
            long_span=long_span,
            aspect_ratio=aspect_ratio,
            slab_type=slab_type,
            area=lx * ly,
            beam_left=int(beam_left),
            beam_right=int(beam_right),
            beam_bottom=int(beam_bottom),
            beam_top=int(beam_top),
        ))
    panels.sort(key=lambda p: (p.y_min, p.x_min))
    return panels


# ──────────────────────────────────────────────────────────────
# 층(Z) 자동 감지
# ──────────────────────────────────────────────────────────────

def detect_floor_levels(
    nodes: dict[int, Node],
    *,
    z_tol: float = 0.01,
) -> list[float]:
    """노드 Z 좌표 클러스터링으로 존재하는 층 Z 값을 정렬하여 반환."""
    zs = sorted(n.z for n in nodes.values())
    if not zs:
        return []
    clusters: list[list[float]] = [[zs[0]]]
    for z in zs[1:]:
        if z - clusters[-1][-1] <= z_tol:
            clusters[-1].append(z)
        else:
            clusters.append([z])
    return [sum(c) / len(c) for c in clusters]


# ──────────────────────────────────────────────────────────────
# 종합 분석
# ──────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────
# Floor Load 매칭 (point-in-polygon + Z 레벨 필터)
# ──────────────────────────────────────────────────────────────

def point_in_polygon(
    px: float,
    py: float,
    polygon: Sequence[tuple[float, float]],
) -> bool:
    """Ray casting 알고리즘. 경계는 포함.

    다각형 꼭짓점이 3개 미만이면 False. Self-intersecting 도형은 지원 안 함
    (일반 Floor Load 영역은 단순 다각형으로 가정).
    """
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        # 수평선 교차 검사
        intersects = ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def factored_load(area: FloorLoadArea) -> float:
    """[KDS 14 20 10] 계수하중 Wu = 1.2D + 1.6L (kN/m²)."""
    return 1.2 * area.dl + 1.6 * area.ll


def match_panel_to_loads(
    panel: SlabPanel,
    areas: Sequence[FloorLoadArea],
    *,
    z_tol: float = 0.1,
) -> PanelLoadMatchResult:
    """패널 중심점이 포함되는 모든 FloorLoadArea 를 반환.

    대표값(primary) 은 Wu = 1.2D + 1.6L 가 가장 큰 영역 — 가장 불리한 조건으로
    보수적 설계. matches 는 매칭된 **모든** 영역을 Wu 내림차순 (동일 시
    (DL+LL) 내림차순 → 이름 오름차순) 로 정렬한 튜플.
    Z 허용치는 FBLA 노드 평균 Z 와 패널 Z 의 차이 허용값.
    """
    cx = (panel.x_min + panel.x_max) / 2
    cy = (panel.y_min + panel.y_max) / 2
    candidates: list[FloorLoadArea] = []
    for a in areas:
        if abs(a.z_level - panel.z_level) > z_tol:
            continue
        if point_in_polygon(cx, cy, a.polygon):
            candidates.append(a)
    if not candidates:
        return PanelLoadMatchResult(primary=None, matches=())
    candidates.sort(
        key=lambda a: (-factored_load(a), -(a.dl + a.ll), a.fbld_name)
    )
    return PanelLoadMatchResult(primary=candidates[0], matches=tuple(candidates))


def analyze_slab_spans(
    nodes: dict[int, Node],
    elems: list[dict],
    *,
    z_tol: float = 0.01,
    skew_tol_deg: float = 5.0,
    pos_tol: float = 0.01,
    min_span: float = 0.5,
    merge_beams: bool = True,
    levels: list[float] | None = None,
) -> list[SlabSpanReport]:
    """층별 슬래브 경간 분석 종합 실행.

    Args:
        levels: 분석할 층 Z 리스트. None → 자동 감지된 모든 수평 보 존재 층.
    """
    segments = build_beam_segments(
        nodes, elems, z_tol=z_tol, skew_tol_deg=skew_tol_deg,
    )
    if merge_beams:
        segments = merge_collinear_beams(segments, pos_tol=pos_tol)

    # 분석 층 선정: levels 지정 시 그대로, 아니면 수평 보가 존재하는 Z 만
    if levels is not None:
        target_levels = sorted(levels)
    else:
        beam_z = sorted({s.z_level for s in segments})
        # 근접값 클러스터링
        target_levels = _cluster_positions(beam_z, z_tol)

    reports: list[SlabSpanReport] = []
    for z in target_levels:
        panels = find_panels_at_level(
            segments, z_level=z,
            pos_tol=pos_tol, min_span=min_span, z_tol=z_tol,
        )
        one_way = sum(1 for p in panels if p.slab_type == "1방향")
        two_way = sum(1 for p in panels if p.slab_type == "2방향")
        max_span = max((p.long_span for p in panels), default=0.0)
        reports.append(SlabSpanReport(
            z_level=z,
            panel_count=len(panels),
            one_way_count=one_way,
            two_way_count=two_way,
            max_span=max_span,
            panels=panels,
        ))
    return reports
