"""프로젝트 전역 설정 라우터 — 축렬(gridline).

엔드포인트:
    GET  /api/project-settings/grid           — 저장된 grid 설정
    PUT  /api/project-settings/grid           — 저장
    POST /api/project-settings/grid/auto-detect — 현재 MIDAS 모델에서 주축 자동 탐지
"""

from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter

import MIDAS_API as MIDAS

import work_dir
from exceptions import MidasApiError
from engines.slab_span import (
    build_beam_segments,
    detect_principal_axes,
)
from models.project_settings import (
    GridAutoDetectResult,
    GridAxisItem,
    ProjectGridSettings,
)
from routers.slab_span import _load_nodes_and_elems, _unwrap


_DIST_TO_MM: dict[str, float] = {
    "MM": 1.0,
    "CM": 10.0,
    "M": 1000.0,
    "IN": 25.4,
    "FT": 304.8,
}


def _get_unit_to_mm_factor() -> float:
    """현재 MIDAS DIST 단위 → mm 변환 계수. 실패 시 1.0 (mm 가정)."""
    try:
        raw = MIDAS.MidasAPI("GET", "/db/UNIT")
    except Exception as e:
        logger.warning("UNIT 조회 실패 — mm 가정: %s", e)
        return 1.0
    unit = _unwrap(raw, "UNIT") if isinstance(raw, dict) else {}
    if not isinstance(unit, dict) or not unit:
        return 1.0
    candidate: dict = unit
    if all(isinstance(v, dict) for v in unit.values()):
        candidate = next(iter(unit.values()), {})
    dist = str(candidate.get("DIST", "MM")).upper()
    return _DIST_TO_MM.get(dist, 1.0)

router = APIRouter()
logger = logging.getLogger(__name__)

_GRID_FILE = "project_grid.json"


def _grid_path() -> str:
    return work_dir.get_save_path(_GRID_FILE)


@router.get("/project-settings/grid")
def get_grid_settings() -> ProjectGridSettings:
    """저장된 grid 설정. 없으면 빈 기본값."""
    path = _grid_path()
    if not os.path.isfile(path):
        return ProjectGridSettings()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectGridSettings.model_validate(data)
    except Exception as e:
        logger.warning("grid 설정 파일 읽기 실패: %s", e)
        return ProjectGridSettings()


@router.put("/project-settings/grid")
def save_grid_settings(body: ProjectGridSettings) -> dict:
    """grid 설정 저장 (전체 덮어쓰기).

    offset 기준 오름차순으로 재정렬 후 저장.
    """
    body.x_axes.sort(key=lambda a: a.offset)
    body.y_axes.sort(key=lambda a: a.offset)
    path = _grid_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(body.model_dump(), f, ensure_ascii=False, indent=2)
    return {"status": "saved", "x_count": len(body.x_axes), "y_count": len(body.y_axes)}


@router.post("/project-settings/grid/auto-detect")
def auto_detect_grid(pos_tol_mm: float = 500.0) -> GridAutoDetectResult:
    """현재 MIDAS 모델의 보 데이터로 주축 자동 탐지.

    pos_tol_mm: 축렬 offset 클러스터링 허용오차 (mm, 기본 500mm).
    반환된 origin/offsets 는 **mm 단위로 정규화**되어 모델 단위와 무관하게 일관.
    """
    try:
        nodes, elems = _load_nodes_and_elems()
    except Exception as e:
        logger.error("NODE/ELEM 조회 실패: %s", e)
        raise MidasApiError("NODE/ELEM 조회 실패", cause=str(e))

    segments = build_beam_segments(nodes, elems)
    if not segments:
        return GridAutoDetectResult(
            angle_deg=0.0, origin=(0.0, 0.0), x_offsets=[], y_offsets=[],
        )

    unit_to_mm = _get_unit_to_mm_factor()
    # detect_principal_axes 의 pos_tol 은 모델 단위 → mm 입력값을 모델 단위로 변환
    pos_tol_model = pos_tol_mm / unit_to_mm
    result = detect_principal_axes(segments, pos_tol=pos_tol_model)

    # 결과(모델 단위) → mm 로 변환
    x_mm = [v * unit_to_mm for v in result["x_offsets"]]
    y_mm = [v * unit_to_mm for v in result["y_offsets"]]
    origin_mm = (
        result["origin"][0] * unit_to_mm,
        result["origin"][1] * unit_to_mm,
    )

    return GridAutoDetectResult(
        angle_deg=result["angle_deg"],
        origin=origin_mm,
        x_offsets=x_mm,
        y_offsets=y_mm,
    )


@router.post("/project-settings/grid/apply-auto-detect")
def apply_auto_detect(
    pos_tol_mm: float = 500.0,
    label_format: str = "prefix",
) -> ProjectGridSettings:
    """자동 탐지 결과를 그대로 적용해 저장 (빠른 초기 설정용).

    pos_tol_mm: 축렬 클러스터링 허용오차 (mm).
    라벨은 label_format 에 따라 자동 부여:
      - "prefix": X1, X2, ... / Y1, Y2, ...
      - "simple": 1, 2, ... / A, B, ...
    """
    result = auto_detect_grid(pos_tol_mm=pos_tol_mm)

    def _label_x(i: int) -> str:
        return f"X{i + 1}" if label_format == "prefix" else str(i + 1)

    def _label_y(i: int) -> str:
        if label_format == "prefix":
            return f"Y{i + 1}"
        # A, B, ..., Z, AA, AB, ...
        n = i
        s = ""
        while True:
            s = chr(ord("A") + n % 26) + s
            n = n // 26 - 1
            if n < 0:
                break
        return s

    settings = ProjectGridSettings(
        angle_deg=result.angle_deg,
        origin=result.origin,
        x_axes=[
            GridAxisItem(label=_label_x(i), offset=off)
            for i, off in enumerate(result.x_offsets)
        ],
        y_axes=[
            GridAxisItem(label=_label_y(i), offset=off)
            for i, off in enumerate(result.y_offsets)
        ],
        label_format=label_format,  # type: ignore[arg-type]
        auto_detected=True,
    )
    save_grid_settings(settings)
    return settings
