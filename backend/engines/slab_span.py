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
    """수평 보 1개 (또는 병합된 여러 보)의 세그먼트.

    - direction="X" / "Y" 는 **X/Y 축 정렬 보** — axis_min/max/cross_pos 로 표현
    - direction="SKEW" 는 **사선 보** — (x1,y1)-(x2,y2) 좌표만 의미 있음
    """
    elem_id: int            # 원본 elem id (병합된 보는 첫 원본 id)
    direction: Literal["X", "Y", "SKEW"]
    z_level: float
    axis_min: float = 0.0   # X: x_min, Y: y_min, SKEW: 사용 안 함
    axis_max: float = 0.0
    cross_pos: float = 0.0  # X: y 좌표, Y: x 좌표, SKEW: 사용 안 함
    # 항상 채워지는 원본 양 끝 좌표 (시각화용)
    x1: float = 0.0
    y1: float = 0.0
    x2: float = 0.0
    y2: float = 0.0

    @property
    def length(self) -> float:
        if self.direction == "SKEW":
            return math.hypot(self.x2 - self.x1, self.y2 - self.y1)
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
    # ── face 탐색 + OMBB 기반 확장 필드 (default 로 하위 호환) ──
    polygon: tuple[tuple[float, float], ...] = ()        # 실제 꼭짓점 (N각형)
    orientation_deg: float = 0.0                          # OMBB 회전각 0~90
    ombb_vertices: tuple[tuple[float, float], ...] = ()   # OMBB 4개 꼭짓점 (CCW)
    vertex_count: int = 4                                  # 3/4/5/6...


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
    include_skew: bool = True,
) -> list[BeamSegment]:
    """엘레먼트 리스트에서 수평 보(TYPE=BEAM + 양단 Z 일치)를 필터.

    include_skew=True (기본) 면 X/Y 축과 정렬되지 않은 사선 보도 포함하되
    `direction="SKEW"` 로 표시한다. 사선 보는 **시각화용**으로만 사용되고
    패널 그리드 탐색(find_panels_at_level)에서는 자동으로 제외된다.

    기둥(수직 부재) 은 항상 제외.
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
        if direction == "SKEW" and not include_skew:
            continue
        z_level = (n1.z + n2.z) / 2.0

        # 공통: 원본 좌표 저장 (시각화용)
        x1, y1, x2, y2 = n1.x, n1.y, n2.x, n2.y

        if direction == "X":
            axis_min = min(n1.x, n2.x)
            axis_max = max(n1.x, n2.x)
            cross_pos = (n1.y + n2.y) / 2.0
        elif direction == "Y":
            axis_min = min(n1.y, n2.y)
            axis_max = max(n1.y, n2.y)
            cross_pos = (n1.x + n2.x) / 2.0
        else:
            # SKEW: 축 파생값은 무효
            axis_min = 0.0
            axis_max = 0.0
            cross_pos = 0.0

        segments.append(BeamSegment(
            elem_id=int(e["id"]),
            direction=direction,
            z_level=z_level,
            axis_min=axis_min,
            axis_max=axis_max,
            cross_pos=cross_pos,
            x1=x1, y1=y1, x2=x2, y2=y2,
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
    SKEW 세그먼트는 병합 없이 그대로 통과.
    """
    if not segments:
        return []

    # SKEW 도 같은 직선 위에 있으면 병합 (끊어져 보이는 문제 방지)
    skew_segments = _merge_skew_beams(
        [s for s in segments if s.direction == "SKEW"], pos_tol=pos_tol,
    )
    axis_segments = [s for s in segments if s.direction in ("X", "Y")]

    # 그룹 키: (direction, z_level 스냅, cross_pos 스냅)
    def snap(v: float) -> float:
        return round(v / pos_tol) * pos_tol if pos_tol > 0 else v

    buckets: dict[tuple[str, float, float], list[BeamSegment]] = {}
    for s in axis_segments:
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
        # 병합 구간의 양 끝에 해당하는 **원본 세그먼트** 참조 유지 — 원본 좌표 보존용
        lo_seg: BeamSegment = group_sorted[0]
        hi_seg: BeamSegment = group_sorted[0]
        for s in group_sorted[1:]:
            if s.axis_min <= cur_max + pos_tol:
                # 연결 가능 → 확장
                if s.axis_max > cur_max:
                    cur_max = s.axis_max
                    hi_seg = s
            else:
                merged.append(_axis_seg_preserve_coords(
                    cur_id, direction, z_level, cur_min, cur_max, cross_pos,
                    lo_seg, hi_seg,
                ))
                cur_min = s.axis_min
                cur_max = s.axis_max
                cur_id = s.elem_id
                lo_seg = s
                hi_seg = s
        merged.append(_axis_seg_preserve_coords(
            cur_id, direction, z_level, cur_min, cur_max, cross_pos,
            lo_seg, hi_seg,
        ))
    # SKEW 는 그대로 뒤에 붙임
    merged.extend(skew_segments)
    return merged


def _merge_skew_beams(
    skews: list[BeamSegment],
    *,
    pos_tol: float = 0.01,
    z_tol: float = 0.01,
) -> list[BeamSegment]:
    """같은 직선 위에 있는 사선 세그먼트들을 하나로 병합.

    직선 정체성: `(정규화된 방향 벡터, 원점으로부터의 부호 있는 수직거리, z)`.
    병합된 세그먼트의 끝점은 snap 값에서 재계산하지 않고 **그룹 내 원본
    끝점 좌표를 그대로 보존** — 거의 수평/수직에 가까운 사선에서도
    실제 기울기가 유지된다.
    """
    if not skews:
        return []

    def snap(v: float, t: float) -> float:
        return round(v / t) * t if t > 0 else v

    # 단위 방향 벡터 부호 통일: ux > 0 (ux=0 이면 uy > 0)
    def canonical_dir(dx: float, dy: float) -> tuple[float, float]:
        L = math.hypot(dx, dy)
        if L < 1e-12:
            return (0.0, 0.0)
        ux, uy = dx / L, dy / L
        if ux < -1e-12 or (abs(ux) < 1e-12 and uy < 0):
            ux, uy = -ux, -uy
        return (ux, uy)

    def line_key(s: BeamSegment):
        ux, uy = canonical_dir(s.x2 - s.x1, s.y2 - s.y1)
        if ux == 0.0 and uy == 0.0:
            return None
        offset = -uy * s.x1 + ux * s.y1
        # 방향 벡터는 0.001 정밀도, offset 은 pos_tol (기하 허용오차 수준)
        return (
            snap(ux, 1e-3),
            snap(uy, 1e-3),
            snap(offset, pos_tol),
            snap(s.z_level, z_tol),
        )

    groups: dict[tuple, list[BeamSegment]] = {}
    for s in skews:
        k = line_key(s)
        if k is None:
            continue
        groups.setdefault(k, []).append(s)

    merged: list[BeamSegment] = []
    for key, group in groups.items():
        # 그룹 내 "원본 방향 벡터" 를 첫 세그먼트에서 정확히 가져옴
        # (snap된 key가 아니라 실제값을 기준 t 계산에 사용)
        first = group[0]
        ux0, uy0 = canonical_dir(first.x2 - first.x1, first.y2 - first.y1)
        # 각 세그먼트를 (t_lo, t_hi, 원본좌표) 로 준비
        # 방향이 반대인 세그먼트는 (x2,y2)가 t 작은 쪽이 될 수 있어 정렬
        entries: list[tuple[float, float, tuple[float, float], tuple[float, float], int]] = []
        for s in group:
            t1 = ux0 * s.x1 + uy0 * s.y1
            t2 = ux0 * s.x2 + uy0 * s.y2
            if t1 <= t2:
                entries.append((t1, t2, (s.x1, s.y1), (s.x2, s.y2), s.elem_id))
            else:
                entries.append((t2, t1, (s.x2, s.y2), (s.x1, s.y1), s.elem_id))
        entries.sort(key=lambda e: e[0])

        cur_lo, cur_hi, p_lo, p_hi, cur_id = entries[0]
        for t_lo, t_hi, q_lo, q_hi, eid in entries[1:]:
            if t_lo <= cur_hi + pos_tol:
                if t_hi > cur_hi:
                    cur_hi = t_hi
                    p_hi = q_hi
            else:
                merged.append(BeamSegment(
                    elem_id=cur_id, direction="SKEW",
                    z_level=first.z_level,
                    x1=p_lo[0], y1=p_lo[1],
                    x2=p_hi[0], y2=p_hi[1],
                ))
                cur_lo, cur_hi, p_lo, p_hi, cur_id = t_lo, t_hi, q_lo, q_hi, eid
        merged.append(BeamSegment(
            elem_id=cur_id, direction="SKEW",
            z_level=first.z_level,
            x1=p_lo[0], y1=p_lo[1],
            x2=p_hi[0], y2=p_hi[1],
        ))
    return merged


def _axis_seg(
    elem_id: int,
    direction: str,
    z_level: float,
    axis_min: float,
    axis_max: float,
    cross_pos: float,
) -> BeamSegment:
    """X/Y 축 정렬 BeamSegment 생성 — x1,y1,x2,y2 는 axis 기반으로 수평화된 값."""
    if direction == "X":
        x1, y1, x2, y2 = axis_min, cross_pos, axis_max, cross_pos
    elif direction == "Y":
        x1, y1, x2, y2 = cross_pos, axis_min, cross_pos, axis_max
    else:
        x1 = y1 = x2 = y2 = 0.0
    return BeamSegment(
        elem_id=elem_id,
        direction=direction,  # type: ignore[arg-type]
        z_level=z_level,
        axis_min=axis_min,
        axis_max=axis_max,
        cross_pos=cross_pos,
        x1=x1, y1=y1, x2=x2, y2=y2,
    )


def _axis_seg_preserve_coords(
    elem_id: int,
    direction: str,
    z_level: float,
    axis_min: float,
    axis_max: float,
    cross_pos: float,
    lo_seg: BeamSegment,
    hi_seg: BeamSegment,
) -> BeamSegment:
    """X/Y 병합 시 **원본 양 끝점 좌표** 를 보존하는 버전.

    lo_seg: axis_min 쪽 끝에 해당하는 원본 세그먼트.
    hi_seg: axis_max 쪽 끝에 해당하는 원본 세그먼트.
    x1,y1 = lo_seg 의 "axis_min 쪽" 끝점 원본 좌표.
    x2,y2 = hi_seg 의 "axis_max 쪽" 끝점 원본 좌표.
    skew_tol_deg 이내의 거의 수평/수직 보라도 원본 기울기가 보존됨.
    """
    if direction == "X":
        # lo_seg 에서 x 가 axis_min 에 더 가까운 끝점
        if abs(lo_seg.x1 - axis_min) <= abs(lo_seg.x2 - axis_min):
            x1, y1 = lo_seg.x1, lo_seg.y1
        else:
            x1, y1 = lo_seg.x2, lo_seg.y2
        if abs(hi_seg.x2 - axis_max) <= abs(hi_seg.x1 - axis_max):
            x2, y2 = hi_seg.x2, hi_seg.y2
        else:
            x2, y2 = hi_seg.x1, hi_seg.y1
    elif direction == "Y":
        if abs(lo_seg.y1 - axis_min) <= abs(lo_seg.y2 - axis_min):
            x1, y1 = lo_seg.x1, lo_seg.y1
        else:
            x1, y1 = lo_seg.x2, lo_seg.y2
        if abs(hi_seg.y2 - axis_max) <= abs(hi_seg.y1 - axis_max):
            x2, y2 = hi_seg.x2, hi_seg.y2
        else:
            x2, y2 = hi_seg.x1, hi_seg.y1
    else:
        x1 = y1 = x2 = y2 = 0.0
    return BeamSegment(
        elem_id=elem_id,
        direction=direction,  # type: ignore[arg-type]
        z_level=z_level,
        axis_min=axis_min,
        axis_max=axis_max,
        cross_pos=cross_pos,
        x1=x1, y1=y1, x2=x2, y2=y2,
    )


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
# OMBB (Oriented Minimum Bounding Box) — 회전 허용 최소 외접 사각형
# ──────────────────────────────────────────────────────────────

def _polygon_signed_area(poly: Sequence[tuple[float, float]]) -> float:
    """Shoelace 부호 있는 면적 (CCW = 양수)."""
    n = len(poly)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def _polygon_area(poly: Sequence[tuple[float, float]]) -> float:
    """다각형 면적 (절댓값)."""
    return abs(_polygon_signed_area(poly))


def _polygon_centroid(poly: Sequence[tuple[float, float]]) -> tuple[float, float]:
    """다각형 중심 (signed area 기반). 면적 0이면 평균점."""
    n = len(poly)
    if n == 0:
        return (0.0, 0.0)
    a2 = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a2 += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if abs(a2) < 1e-12:
        sx = sum(p[0] for p in poly) / n
        sy = sum(p[1] for p in poly) / n
        return (sx, sy)
    return (cx / (3.0 * a2), cy / (3.0 * a2))


def _convex_hull(
    points: Sequence[tuple[float, float]],
) -> list[tuple[float, float]]:
    """Andrew's monotone chain. CCW 방향으로 반환, 마지막 점 = 첫 점 제외."""
    pts = sorted(set((round(x, 9), round(y, 9)) for x, y in points))
    if len(pts) < 2:
        return list(pts)

    def cross(o, a, b) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: list[tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _oriented_min_bbox(
    points: Sequence[tuple[float, float]],
) -> tuple[float, float, float, tuple[tuple[float, float], ...]]:
    """Rotating calipers 로 최소 외접 회전 사각형 계산.

    Returns:
        (width, height, angle_deg, vertices(4, CCW))
        - width <= height 보장 (short_span, long_span 구분 편의)
        - angle_deg: long_span 축이 X축과 이루는 각 (0~180, 절댓값 작은 쪽)
        - vertices: 사각형 4 꼭짓점 반시계 방향
    """
    if len(points) < 2:
        return (0.0, 0.0, 0.0, tuple(points))

    hull = _convex_hull(points)
    n = len(hull)
    if n < 2:
        return (0.0, 0.0, 0.0, tuple(hull))
    if n == 2:
        # 선분 — 두께 0
        (x1, y1), (x2, y2) = hull
        length = math.hypot(x2 - x1, y2 - y1)
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        return (0.0, length, angle, ((x1, y1), (x2, y2), (x2, y2), (x1, y1)))

    best_area = float("inf")
    best: tuple[float, float, float, tuple[tuple[float, float], ...]] = (
        0.0, 0.0, 0.0, tuple(hull[:4]) if len(hull) >= 4 else tuple(hull),
    )
    for i in range(n):
        x1, y1 = hull[i]
        x2, y2 = hull[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        if L < 1e-12:
            continue
        ux, uy = dx / L, dy / L  # 방향 벡터
        nx, ny = -uy, ux          # 법선 벡터

        # 모든 hull 점을 이 좌표계로 투영 → min/max
        t_min = t_max = 0.0
        n_min = n_max = 0.0
        first = True
        for px, py in hull:
            tp = ux * (px - x1) + uy * (py - y1)
            np_ = nx * (px - x1) + ny * (py - y1)
            if first:
                t_min = t_max = tp
                n_min = n_max = np_
                first = False
            else:
                t_min = min(t_min, tp)
                t_max = max(t_max, tp)
                n_min = min(n_min, np_)
                n_max = max(n_max, np_)
        w_t = t_max - t_min
        w_n = n_max - n_min
        area = w_t * w_n
        if area < best_area:
            best_area = area
            # 사각형 4 꼭짓점 (CCW)
            def pt(t, nv):
                return (x1 + ux * t + nx * nv, y1 + uy * t + ny * nv)

            v1 = pt(t_min, n_min)
            v2 = pt(t_max, n_min)
            v3 = pt(t_max, n_max)
            v4 = pt(t_min, n_max)
            # short/long 결정
            width = min(w_t, w_n)
            height = max(w_t, w_n)
            # 각도: long_span 축의 기울기
            if w_t >= w_n:
                angle_rad = math.atan2(uy, ux)
            else:
                angle_rad = math.atan2(ny, nx)
            angle_deg = math.degrees(angle_rad)
            # -90 ~ 90 으로 정규화
            while angle_deg > 90.0:
                angle_deg -= 180.0
            while angle_deg < -90.0:
                angle_deg += 180.0
            best = (width, height, angle_deg, (v1, v2, v3, v4))

    return best


# ──────────────────────────────────────────────────────────────
# 평면 그래프 Face 탐색 (삼각형/오각형/회전 사각형 지원)
# ──────────────────────────────────────────────────────────────

def _build_planar_graph(
    segments: list[BeamSegment],
    pos_tol: float,
) -> tuple[dict[int, tuple[float, float]], list[tuple[int, int]]]:
    """BeamSegment 들을 평면 그래프로 변환.

    Returns:
        (nodes: {node_id: (x,y)}, edges: [(nid1, nid2), ...])
        노드 좌표는 pos_tol 로 스냅하여 같은 좌표끼리 통합.
    """
    def snap(v: float) -> float:
        return round(v / pos_tol) * pos_tol if pos_tol > 0 else v

    node_ids: dict[tuple[float, float], int] = {}
    node_coords: dict[int, tuple[float, float]] = {}
    edges: set[tuple[int, int]] = set()

    def add_node(x: float, y: float) -> int:
        key = (snap(x), snap(y))
        if key in node_ids:
            return node_ids[key]
        nid = len(node_ids)
        node_ids[key] = nid
        node_coords[nid] = (x, y)  # 원본 좌표 유지
        return nid

    for s in segments:
        a = add_node(s.x1, s.y1)
        b = add_node(s.x2, s.y2)
        if a == b:
            continue
        edges.add((min(a, b), max(a, b)))

    return node_coords, list(edges)


def _extract_faces(
    nodes: dict[int, tuple[float, float]],
    edges: list[tuple[int, int]],
) -> list[list[int]]:
    """평면 그래프에서 내부 face(닫힌 다각형) 추출.

    알고리즘:
    1. 각 edge 를 양방향 half-edge 로 분리
    2. 각 노드의 out-edge 를 **각도** 오름차순 정렬
    3. 각 half-edge (u→v) 에 대해 next half-edge 는
       `v 에서의 (v→u 의 역방향) out-edge 중 각도순으로 바로 다음`
       → "왼쪽으로 회전" (CCW face 탐색)
    4. cycle 따라가면 한 face 완성. signed area 양수면 inner face.

    Returns:
        [face1_node_ids, face2_node_ids, ...] 각 face 는 CCW 순.
    """
    # 각 노드의 out-edge 를 각도 오름차순으로 정렬
    out: dict[int, list[tuple[float, int]]] = {nid: [] for nid in nodes}
    for (u, v) in edges:
        xu, yu = nodes[u]
        xv, yv = nodes[v]
        ang_uv = math.atan2(yv - yu, xv - xu)
        ang_vu = math.atan2(yu - yv, xu - xv)
        out[u].append((ang_uv, v))
        out[v].append((ang_vu, u))
    for nid in out:
        out[nid].sort()

    # next(u→v) = v에서 angle((v→u)) 의 바로 앞 항목 (CCW 방향)
    # 구현: v의 out 리스트에서 (v→u) 의 각도를 찾고, 그 이전 인덱스 반환.
    def next_half(u: int, v: int) -> tuple[int, int] | None:
        # DCEL face traversal: v 의 out-edges 각도 정렬에서 (v→u) 바로 **이전**(CW)
        # 엣지가 next half-edge → inner face 를 CCW로 traverse.
        lst = out[v]
        for i, (_ang, _w) in enumerate(lst):
            if _w == u:
                prev_i = (i - 1) % len(lst)
                nxt_w = lst[prev_i][1]
                return (v, nxt_w)
        return None

    visited: set[tuple[int, int]] = set()
    faces: list[list[int]] = []
    # 양방향 half-edge 전부 순회
    half_edges = [(u, v) for (u, v) in edges] + [(v, u) for (u, v) in edges]
    for start in half_edges:
        if start in visited:
            continue
        cycle: list[int] = []
        cur = start
        safety = 0
        while cur not in visited and safety < len(half_edges) + 2:
            visited.add(cur)
            cycle.append(cur[0])
            nxt = next_half(cur[0], cur[1])
            if nxt is None:
                break
            cur = nxt
            if cur == start:
                break
            safety += 1
        if len(cycle) >= 3:
            faces.append(cycle)

    # signed area 양수 (CCW inner face) 만 유지
    inner: list[list[int]] = []
    for face in faces:
        coords = [nodes[nid] for nid in face]
        if _polygon_signed_area(coords) > 0:
            inner.append(face)
    return inner


def find_panels_by_faces(
    segments: list[BeamSegment],
    *,
    z_level: float,
    pos_tol: float = 0.01,
    min_span: float = 0.5,
    z_tol: float = 0.01,
) -> list[SlabPanel]:
    """평면 그래프 face 탐색 + OMBB 로 **임의 다각형 패널**을 검출.

    사각형뿐 아니라 삼각형/오각형/회전 사각형 모두 지원.
    """
    level_segs = [s for s in segments if abs(s.z_level - z_level) <= z_tol]
    if not level_segs:
        return []

    nodes, edges = _build_planar_graph(level_segs, pos_tol)
    if not edges:
        return []

    faces = _extract_faces(nodes, edges)
    if not faces:
        return []

    z_idx = int(round(z_level * 1000))
    panels: list[SlabPanel] = []

    for face_idx, face in enumerate(faces):
        poly = [nodes[nid] for nid in face]
        if len(poly) < 3:
            continue
        area = _polygon_area(poly)
        if area < min_span ** 2:
            continue

        # OMBB 로 short/long span + 회전각
        width, height, angle_deg, ombb = _oriented_min_bbox(poly)
        short_span = width
        long_span = height
        if short_span < min_span:
            continue

        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        aspect_ratio = long_span / short_span if short_span > 0 else 1.0
        slab_type: Literal["1방향", "2방향"] = "1방향" if aspect_ratio >= 2.0 else "2방향"
        panel_id = f"F{z_idx:+d}-{face_idx + 1}"
        panels.append(SlabPanel(
            panel_id=panel_id,
            z_level=z_level,
            x_min=min(xs),
            x_max=max(xs),
            y_min=min(ys),
            y_max=max(ys),
            lx=width,
            ly=height,
            short_span=short_span,
            long_span=long_span,
            aspect_ratio=aspect_ratio,
            slab_type=slab_type,
            area=area,
            beam_left=0, beam_right=0, beam_bottom=0, beam_top=0,
            polygon=tuple(poly),
            orientation_deg=angle_deg,
            ombb_vertices=ombb,
            vertex_count=len(poly),
        ))

    panels.sort(key=lambda p: (p.y_min, p.x_min))
    return panels


# ──────────────────────────────────────────────────────────────
# 주축 + 축렬(Gridline) 자동 탐지
# ──────────────────────────────────────────────────────────────

def detect_principal_axes(
    segments: list[BeamSegment],
    *,
    pos_tol: float = 50.0,
    bin_size_deg: float = 1.0,
) -> dict:
    """보 방향 히스토그램으로 주축 각도 결정 + 축렬 offset 산출.

    알고리즘 (codex 리뷰 반영):
    1. 0~180° 길이 가중 히스토그램
    2. **직교 쌍 최적화**: `score(θ) = hist(θ) + hist(θ+90°)` 최대인 θ 선택
       → 회전 그리드에서 2차 피크 무시 방지, 노이즈 안정
    3. 보를 주축1/주축2 중 가까운 쪽으로 분류, 중점을 법선 방향으로 투영
    4. 투영값을 **적응형 tolerance** 로 클러스터링 (fixed pos_tol + median spacing×15%)
    5. 각 클러스터 대표값은 **median** (외란 강함)

    반환:
      angle_deg: 주축1 각도 (-90~90)
      x_offsets: X 축렬 위치 리스트 (주축2 법선 방향, 오름차순, 최소=0 으로 정규화)
      y_offsets: Y 축렬 위치 리스트 (주축1 법선 방향, 동일)
      origin: offset 기준 원점 world 좌표
    """
    if not segments:
        return {"angle_deg": 0.0, "x_offsets": [], "y_offsets": [], "origin": (0.0, 0.0)}

    n_bins = int(round(180.0 / bin_size_deg))
    half = n_bins // 2  # 90° 인덱스 차
    hist = [0.0] * n_bins

    for s in segments:
        dx = s.x2 - s.x1
        dy = s.y2 - s.y1
        L = math.hypot(dx, dy)
        if L < 1e-9:
            continue
        ang = math.degrees(math.atan2(dy, dx)) % 180.0
        idx = int(ang / bin_size_deg) % n_bins
        hist[idx] += L

    # 직교 쌍 최적화 — θ 와 θ+90° 합이 최대인 θ
    if sum(hist) < 1e-9:
        return {"angle_deg": 0.0, "x_offsets": [], "y_offsets": [], "origin": (0.0, 0.0)}
    best_idx = 0
    best_score = -1.0
    for i in range(half):
        score = hist[i] + hist[(i + half) % n_bins]
        if score > best_score:
            best_score = score
            best_idx = i
    primary_ang = (best_idx + 0.5) * bin_size_deg
    if primary_ang > 90.0:
        primary_ang -= 180.0

    rad = math.radians(primary_ang)
    ux1, uy1 = math.cos(rad), math.sin(rad)
    ux2, uy2 = -uy1, ux1

    # 각 보를 주축1/주축2 중 가까운 쪽으로 분류 + 중점 투영
    x_projections: list[float] = []
    y_projections: list[float] = []
    for s in segments:
        dx = s.x2 - s.x1
        dy = s.y2 - s.y1
        L = math.hypot(dx, dy)
        if L < 1e-9:
            continue
        dot1 = abs(dx * ux1 + dy * uy1) / L
        dot2 = abs(dx * ux2 + dy * uy2) / L
        mx, my = (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2
        if dot1 >= dot2:
            y_projections.append(mx * ux2 + my * uy2)
        else:
            x_projections.append(mx * ux1 + my * uy1)

    def _cluster_median(vals: list[float], tol: float) -> list[float]:
        """1D 값들을 tol 로 클러스터링, 각 cluster 대표값은 median."""
        if not vals:
            return []
        sv = sorted(vals)
        clusters: list[list[float]] = [[sv[0]]]
        for v in sv[1:]:
            if v - clusters[-1][-1] <= tol:
                clusters[-1].append(v)
            else:
                clusters.append([v])
        reps: list[float] = []
        for c in clusters:
            m = len(c)
            if m % 2 == 1:
                reps.append(c[m // 2])
            else:
                reps.append((c[m // 2 - 1] + c[m // 2]) / 2.0)
        return reps

    # 1차 클러스터 → 축렬 간격 중앙값 계산 → 적응형 tolerance
    def _adaptive_cluster(vals: list[float]) -> list[float]:
        if not vals:
            return []
        first = _cluster_median(vals, pos_tol)
        if len(first) < 2:
            return first
        spacings = [first[i + 1] - first[i] for i in range(len(first) - 1)]
        spacings.sort()
        median_spacing = spacings[len(spacings) // 2]
        adaptive_tol = min(pos_tol, max(median_spacing * 0.15, 1e-3))
        # adaptive_tol 이 더 작으면 재클러스터링 (더 세밀)
        if adaptive_tol < pos_tol:
            return _cluster_median(vals, adaptive_tol)
        return first

    x_offsets = _adaptive_cluster(x_projections)
    y_offsets = _adaptive_cluster(y_projections)

    # 원점: 각 offset 리스트 최소값 이동 → 0-base 정규화
    x_base = min(x_offsets) if x_offsets else 0.0
    y_base = min(y_offsets) if y_offsets else 0.0
    x_offsets = [v - x_base for v in x_offsets]
    y_offsets = [v - y_base for v in y_offsets]
    ox = ux1 * x_base + ux2 * y_base
    oy = uy1 * x_base + uy2 * y_base

    return {
        "angle_deg": primary_ang,
        "x_offsets": x_offsets,
        "y_offsets": y_offsets,
        "origin": (ox, oy),
    }


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
    method: Literal["face", "grid"] = "face",
) -> list[SlabSpanReport]:
    """층별 슬래브 경간 분석 종합 실행.

    Args:
        levels: 분석할 층 Z 리스트. None → 자동 감지된 모든 수평 보 존재 층.
        method: 패널 탐색 알고리즘.
            - "face" (기본): 평면 그래프 face 탐색 + OMBB. 삼각형/오각형/회전 지원.
            - "grid": Union-Find 기반 축정렬 사각형 탐색 (레거시).
    """
    segments = build_beam_segments(
        nodes, elems, z_tol=z_tol, skew_tol_deg=skew_tol_deg,
    )
    # method="face" 는 중간 노드(교차점)를 보존해야 하므로 merge 생략.
    # method="grid" 는 기존처럼 merge 해야 분할된 보가 하나로 합쳐져 grid 구성 가능.
    if merge_beams and method == "grid":
        segments_for_panels = merge_collinear_beams(segments, pos_tol=pos_tol)
    else:
        segments_for_panels = segments

    # 분석 층 선정: levels 지정 시 그대로, 아니면 수평 보가 존재하는 Z 만
    if levels is not None:
        target_levels = sorted(levels)
    else:
        beam_z = sorted({s.z_level for s in segments_for_panels})
        target_levels = _cluster_positions(beam_z, z_tol)

    reports: list[SlabSpanReport] = []
    for z in target_levels:
        if method == "face":
            panels = find_panels_by_faces(
                segments_for_panels, z_level=z,
                pos_tol=pos_tol, min_span=min_span, z_tol=z_tol,
            )
        else:
            panels = find_panels_at_level(
                segments_for_panels, z_level=z,
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
