"""프로젝트 전역 설정 Pydantic 모델 — 축렬(gridline) 등."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class GridAxisItem(BaseModel):
    """축렬 1개 — 사용자 지정 라벨 + 주축 좌표계에서의 offset."""
    label: str          # 사용자 지정 (기본 "X1", "Y1", 또는 "1", "A")
    offset: float       # 주축 좌표계에서의 1D 위치 (모델 원본 단위)


class GridAxisGroup(BaseModel):
    """회전각이 다른 추가 축렬 그룹 (예: 30° 사선 그리드, 특정 동 그리드 등).

    각 그룹은 **한 방향** 의 축렬 세트. angle_deg 는 "축렬 방향" 의 각도.
    axes[i].offset 는 angle_deg 방향의 **법선** (angle_deg + 90°) 으로의 1D 위치.

    예: angle_deg=30, origin=(0,0), axes=[(label="A1", offset=0), (label="A2", offset=5)]
        → 30° 방향 평행선 2개가 법선(120°) 방향으로 0, 5 위치.
    """
    name: str                                       # 그룹 표시명 (예: "30° 사선")
    angle_deg: float                                 # 축렬 방향각
    origin: tuple[float, float] = (0.0, 0.0)
    axes: list[GridAxisItem] = Field(default_factory=list)
    color: str = "#60a5fa"                           # 선/버블 색 (hex)


class ProjectGridSettings(BaseModel):
    """건물 축렬 설정.

    angle_deg: 주축1(X 축렬 방향) 각도. 0 이면 X축 정렬. 양수 = 반시계.
    origin: 축렬 좌표계의 원점 (world 좌표).
    x_axes / y_axes: 각 방향 축렬 목록 (offset 오름차순 정렬).
    label_format:
      - "prefix": X1/X2/... / Y1/Y2/... (기본, 라벨에 축 접두어)
      - "simple": 1/2/... / A/B/... (건축 도면 관례)
    """
    angle_deg: float = 0.0
    origin: tuple[float, float] = (0.0, 0.0)
    x_axes: list[GridAxisItem] = Field(default_factory=list)
    y_axes: list[GridAxisItem] = Field(default_factory=list)
    label_format: Literal["prefix", "simple"] = "prefix"
    auto_detected: bool = False
    extra_groups: list[GridAxisGroup] = Field(default_factory=list)


class GridAutoDetectResult(BaseModel):
    """자동 탐지 API 응답 — 사용자가 채택 전 미리보기 용도."""
    angle_deg: float
    origin: tuple[float, float]
    x_offsets: list[float]
    y_offsets: list[float]
