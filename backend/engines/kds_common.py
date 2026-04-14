"""KDS 계산 공통 유틸.

이 모듈은 KDS 엔진에서 반복되는 보간/클램프/수요-성능비 계산을 통합한다.
"""

from __future__ import annotations


def clamp(value: float, min_value: float, max_value: float) -> float:
    """값을 [min_value, max_value] 범위로 제한한다."""
    return min(max(value, min_value), max_value)


def linear_interpolate(x: float, x0: float, y0: float, x1: float, y1: float) -> float:
    """두 점 (x0, y0), (x1, y1) 사이 선형보간."""
    if x1 == x0:
        return y0
    t = (x - x0) / (x1 - x0)
    return y0 + t * (y1 - y0)


def interpolate_piecewise(points: list[float], values: list[float], x: float) -> float:
    """정렬된 점/값에 대해 구간별 선형보간을 수행한다."""
    if not points or not values or len(points) != len(values):
        raise ValueError("points와 values는 동일 길이의 비어있지 않은 배열이어야 합니다.")

    if x <= points[0]:
        return values[0]
    if x >= points[-1]:
        return values[-1]

    for i in range(len(points) - 1):
        x0, x1 = points[i], points[i + 1]
        if x0 <= x <= x1:
            return linear_interpolate(x, x0, values[i], x1, values[i + 1])
    return values[-1]


def demand_capacity_ratio(demand: float, capacity: float, fallback: float = 999.0) -> float:
    """D/C 비를 계산한다. 용량이 0 이하이면 fallback 반환."""
    if capacity <= 0:
        return fallback
    return abs(demand) / capacity
