"""Load Map — 층별 평면 프레임 + Floor Load 오버레이 Pydantic 모델."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class LoadMapRequest(BaseModel):
    story_names: Optional[list[str]] = None
    z_tol: float = 0.01
    skew_tol_deg: float = 5.0
    pos_tol: float = 0.01
    merge_beams: bool = True


class LoadMapBeam(BaseModel):
    elem_id: int
    direction: Literal["X", "Y", "SKEW"]
    x1: float
    y1: float
    x2: float
    y2: float


class LoadMapArea(BaseModel):
    """Floor Load 한 영역 (다각형 + 하중 값)."""
    fbld_name: str
    polygon: list[tuple[float, float]] = Field(default_factory=list)
    z_level: float
    dl: float = 0.0         # kN/m²
    ll: float = 0.0         # kN/m²
    factored: float = 0.0   # Wu = 1.2D + 1.6L


class LoadMapLevel(BaseModel):
    z_level: float
    story_name: str = ""
    beams: list[LoadMapBeam] = Field(default_factory=list)
    load_areas: list[LoadMapArea] = Field(default_factory=list)


class LoadMapResponse(BaseModel):
    level_count: int
    total_area_count: int
    reports: list[LoadMapLevel] = Field(default_factory=list)
