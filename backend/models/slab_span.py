"""슬래브 경간 분석 Pydantic 모델."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── 층 목록 ──

class StoryOut(BaseModel):
    name: str
    level: float               # Z 좌표 (m)
    height: float = 0.0         # 해당 층 두께 (m)


# ── 분석 요청 ──

class SlabSpanAnalyzeRequest(BaseModel):
    story_names: Optional[list[str]] = None
    exclude_section_prefixes: list[str] = Field(default_factory=list)
    z_tol: float = 0.01
    skew_tol_deg: float = 5.0
    pos_tol: float = 0.01
    min_span: float = 0.5
    merge_beams: bool = True


# ── 분석 응답 ──

class FloorLoadBreakdownItem(BaseModel):
    """한 패널에 매칭된 Floor Load 영역 하나의 세부 정보."""
    name: str
    dl: float          # kN/m²
    ll: float          # kN/m²
    factored: float    # Wu = 1.2D + 1.6L (kN/m²)
    is_primary: bool = False


class PanelOut(BaseModel):
    panel_id: str
    z_level: float
    story_name: str = ""
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    lx: float
    ly: float
    short_span: float
    long_span: float
    aspect_ratio: float
    slab_type: Literal["1방향", "2방향"]
    area: float
    beam_left: int
    beam_right: int
    beam_bottom: int
    beam_top: int
    # face 탐색 + OMBB 기반 확장 필드
    polygon: list[tuple[float, float]] = Field(default_factory=list)
    orientation_deg: float = 0.0
    ombb_vertices: list[tuple[float, float]] = Field(default_factory=list)
    vertex_count: int = 4
    # Floor Load 매칭 결과 (primary = Wu 최대, 매칭 없으면 null)
    floor_load_name: Optional[str] = None
    floor_load_dl: Optional[float] = None        # kN/m²
    floor_load_ll: Optional[float] = None        # kN/m²
    floor_load_total: Optional[float] = None     # DL+LL
    floor_load_factored: Optional[float] = None  # Wu = 1.2D+1.6L (대표값)
    # 매칭이 2개 이상일 때 팝오버에서 세부내역 표시용
    floor_load_matches: list[FloorLoadBreakdownItem] = Field(default_factory=list)


class BeamSegmentOut(BaseModel):
    elem_id: int
    direction: Literal["X", "Y", "SKEW"]
    x1: float
    y1: float
    x2: float
    y2: float


class LevelReportOut(BaseModel):
    z_level: float
    story_name: str = ""
    panel_count: int
    one_way_count: int
    two_way_count: int
    max_span: float
    panels: list[PanelOut] = Field(default_factory=list)
    beams: list[BeamSegmentOut] = Field(default_factory=list)


class SlabSpanAnalyzeResponse(BaseModel):
    level_count: int
    total_panels: int
    reports: list[LevelReportOut] = Field(default_factory=list)
    # 디버깅/로그용 Floor Load 연동 요약
    floor_load_area_count: int = 0
    floor_load_matched_count: int = 0


# ── 슬래브 배근표 (분류 단위) ──

class SlabSectionItem(BaseModel):
    """슬래브 분류(S) 1개의 두께/TYPE/위치별 배근.

    TYPE 은 회사 표준 상세도(A/B/C/D/E) 중 하나. 위치별 배근(X1~X5, Y1~Y5) 은
    자유 문자열로 `HD13@200` 같은 표기를 그대로 저장 — 수치 파싱은 후속.
    """
    name: str                     # 분류명 (S1, RS1, ...)
    type: str = ""                # "A" | "B" | "C" | "D" | "E" | ""
    thk: Optional[float] = None   # mm
    x1: str = ""
    x2: str = ""
    x3: str = ""
    x4: str = ""
    x5: str = ""
    y1: str = ""
    y2: str = ""
    y3: str = ""
    y4: str = ""
    y5: str = ""
    note: str = ""


# ── 스냅샷 (분석 결과 + 이름 매핑 + 배근표) ──

class SlabSpanSnapshotSaveRequest(BaseModel):
    analysis: SlabSpanAnalyzeResponse
    names: dict[str, str] = Field(default_factory=dict)
    sections: list[SlabSectionItem] = Field(default_factory=list)


class SlabSpanSnapshotListItem(BaseModel):
    name: str
    saved_at: str
    total_panels: int
    level_count: int


class SlabSpanSnapshotFull(BaseModel):
    name: str
    saved_at: str
    analysis: SlabSpanAnalyzeResponse
    names: dict[str, str] = Field(default_factory=dict)
    sections: list[SlabSectionItem] = Field(default_factory=list)
