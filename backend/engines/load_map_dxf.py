"""Load Map → DXF 직렬화 엔진.

FBLA 영역 다각형 + fbld_name 텍스트 라벨을 ezdxf 로 R2018 DXF (mm 고정) 로 변환.

순수 함수 — I/O 없음. 입력은 FloorLoadArea 리스트 (slab_span 엔진 산출물).

기능:
- FBLA 영역 → LWPOLYLINE (외곽선) + 솔리드 HATCH (반투명 fill)
- fbld_name 별 ACI 색상/레이어 분리, 한글 라벨은 TEXT 그대로
- shrink_mm 으로 다각형 내부 inset (프론트 LoadMapView 의 polygonInset 과 동일 알고리즘)
"""

from __future__ import annotations

import math
from io import StringIO
from typing import Iterable, Sequence

import ezdxf
from ezdxf.enums import TextEntityAlignment

from .slab_span import FloorLoadArea, _polygon_centroid


# AutoCAD ACI 컬러 인덱스 — 10번 이후 영역에서 골고루 분포한 hue 선택.
# 1~7 은 표준 라인 색상(흑백 인쇄 시 단색 변환)이라 컬러 도면에 부적합.
# 10 단위로 hue 변화 (30=orange, 50=yellow, 90=cyan-green, 130=cyan, 170=blue,
# 210=magenta, 230=pink, 150=green). 7(흰/검) 은 텍스트 전용으로 예약.
_ACI_PALETTE: tuple[int, ...] = (30, 50, 90, 130, 150, 170, 210, 230)

# 솔리드 해치 투명도 (0=불투명, 1=완전 투명).
# 50% 정도면 fbld 색상 구분 + 텍스트/외곽선 가독성 모두 확보.
_HATCH_TRANSPARENCY: float = 0.5


def _layer_color(name: str) -> int:
    """하중명 해시 기반으로 컬러 ACI 인덱스(10번 이후) 결정 (동일 이름 → 동일 색)."""
    if not name:
        return 7  # 빈 이름은 텍스트 색(흰/검 자동) 으로 fallback
    h = sum(ord(c) for c in name)
    return _ACI_PALETTE[h % len(_ACI_PALETTE)]


def _sanitize_layer(name: str) -> str:
    """DXF 레이어 명명 규칙에 맞도록 ASCII 영문/숫자/밑줄/하이픈만 유지.

    한글·공백·특수문자는 모두 '_' 로 치환해 AutoCAD/ZWCAD 등에서 경고 없이 열림.
    원본 한글명은 TEXT 엔티티에 그대로 들어가므로 정보 손실은 없다.
    """
    def _ok(c: str) -> bool:
        # ASCII 영문/숫자만 — `str.isalnum()` 은 한글도 True 로 판정하므로 사용 불가
        if "0" <= c <= "9" or "A" <= c <= "Z" or "a" <= c <= "z":
            return True
        return c in "_-"

    safe = "".join(c if _ok(c) else "_" for c in (name or ""))
    return (safe or "UNNAMED")[:80]


def _bbox_diag(pts: Sequence[tuple[float, float]]) -> float:
    if not pts:
        return 0.0
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return math.hypot(max(xs) - min(xs), max(ys) - min(ys))


def _signed_area(poly: Sequence[tuple[float, float]]) -> float:
    """Shoelace 부호 있는 면적 (CCW=양수, CW=음수)."""
    s = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def _line_intersect(
    p1: tuple[float, float], d1: tuple[float, float],
    p2: tuple[float, float], d2: tuple[float, float],
) -> tuple[float, float] | None:
    """두 직선 (p1 + t*d1), (p2 + s*d2) 의 교차점. 평행이면 None."""
    det = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(det) < 1e-12:
        return None
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    t = (dx * d2[1] - dy * d2[0]) / det
    return (p1[0] + t * d1[0], p1[1] + t * d1[1])


def polygon_inset(
    poly: Sequence[tuple[float, float]], d: float,
) -> list[tuple[float, float]]:
    """다각형을 내부로 d 만큼 평행 오프셋(inset).

    각 변을 내부 법선 방향으로 d 평행이동 → 인접 변 직선의 교차점을 새 꼭짓점으로 채택.
    프론트 `LoadMapView.tsx::polygonInset` 과 동일 알고리즘.

    오목/좁은 영역에서 self-intersection 가능하나 작은 d 에서는 실무상 무해.
    d <= 0 이거나 점이 3 개 미만이면 원본 그대로 반환.
    """
    if d <= 0 or len(poly) < 3:
        return list(poly)

    area = _signed_area(poly)
    if abs(area) < 1e-9:
        return list(poly)
    sign = 1.0 if area > 0 else -1.0

    offset_lines: list[tuple[tuple[float, float], tuple[float, float]]] = []
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        ln = math.hypot(dx, dy)
        if ln < 1e-12:
            continue
        ux, uy = dx / ln, dy / ln
        # 내부 법선 (CCW: 왼쪽 법선 = (-uy, ux))
        nx, ny = -uy * sign, ux * sign
        offset_lines.append(((x1 + nx * d, y1 + ny * d), (ux, uy)))

    m = len(offset_lines)
    if m < 3:
        return list(poly)

    result: list[tuple[float, float]] = []
    for i in range(m):
        prev_p, prev_dir = offset_lines[(i - 1) % m]
        curr_p, curr_dir = offset_lines[i]
        pt = _line_intersect(prev_p, prev_dir, curr_p, curr_dir)
        if pt is not None:
            result.append(pt)

    if len(result) < 3:
        return []

    # 사라짐 검사 — d 가 in-radius 보다 클 때 polygon_inset 은 원본 외측으로 펼쳐진
    # 4점을 반환할 수 있다 (부호 동일, 면적은 원본보다 큼). 둘 다 잡아낸다:
    #   1) 면적 부호 뒤집힘
    #   2) 면적이 원본보다 큼 (외측 확대)
    new_area = _signed_area(result)
    if (
        abs(new_area) < 1e-9
        or (new_area > 0) != (area > 0)
        or abs(new_area) > abs(area)
    ):
        return []
    return result


def build_load_map_dxf(
    areas: Iterable[FloorLoadArea],
    *,
    unit_to_mm: float,
    z_level: float | None = None,
    z_tol: float = 0.5,
    shrink_mm: float = 0.0,
    hatch_transparency: float = _HATCH_TRANSPARENCY,
) -> bytes:
    """FBLA 영역 다각형 + 솔리드 해치 + fbld_name 텍스트를 DXF 로 직렬화.

    Args:
        areas: FloorLoadArea 시퀀스 (slab_span 엔진 산출물).
        unit_to_mm: 모델 좌표 → mm 변환 계수 (예: M 모델 → 1000.0, MM 모델 → 1.0).
        z_level: 특정 Z (모델 단위) 만 추출. None 이면 전체 층.
        z_tol: Z 매칭 허용오차 (모델 단위).
        shrink_mm: 다각형 내부 inset 거리 (mm). 프론트 shrink 슬라이더와 동일 의미. 0 이면 원본.
        hatch_transparency: 솔리드 해치 투명도 [0..1] (0=불투명, 1=완전 투명).

    Returns:
        UTF-8 인코딩된 DXF 바이너리. AutoCAD/DraftSight/ZWCAD 등에서 mm 단위로 열림.

    Notes:
        - DXF R2018, $INSUNITS=4 (mm) 로 헤더 설정.
        - 영역마다 그리는 순서: HATCH(아래) → LWPOLYLINE(외곽선) → TEXT(라벨, 별도 layer).
        - 레이어 색상은 fbld_name 해시로 결정 (동일 이름 → 동일 색).
    """
    doc = ezdxf.new("R2018", setup=True)
    doc.header["$INSUNITS"] = 4         # 4 = millimeters
    doc.header["$MEASUREMENT"] = 1      # Metric
    msp = doc.modelspace()

    if "TEXT" not in doc.layers:
        doc.layers.add(name="TEXT", color=7)

    # 한글 텍스트 STYLE 등록 — 기본 Standard STYLE 은 txt.shx (한글 미지원).
    # malgun.ttf (Windows 맑은 고딕) 사용 — AutoCAD/ZWCAD 등 대부분 환경에서 시스템 폰트로 인식.
    # 만약 해당 PC 에 폰트 부재 시 AutoCAD 가 자동으로 SHX fallback (보통 ?? 박스).
    if "HANGUL" not in doc.styles:
        doc.styles.add("HANGUL", font="malgun.ttf")

    seen_layers: set[str] = set()
    for a in areas:
        if z_level is not None and abs(a.z_level - z_level) > z_tol:
            continue
        if not a.polygon or len(a.polygon) < 3:
            continue

        layer = f"FBLA_{_sanitize_layer(a.fbld_name)}"
        color_idx = _layer_color(a.fbld_name)
        if layer not in seen_layers:
            if layer not in doc.layers:
                doc.layers.add(name=layer, color=color_idx)
            seen_layers.add(layer)

        # 1) 좌표 변환 (모델 단위 → mm) + shrink (mm 단위 inset)
        pts_mm = [(x * unit_to_mm, y * unit_to_mm) for x, y in a.polygon]
        if shrink_mm > 0:
            pts_mm = polygon_inset(pts_mm, shrink_mm)
            if len(pts_mm) < 3:
                # inset 후 다각형이 사라진 경우(영역 < 2*shrink) 스킵
                continue

        # 2) 솔리드 해치 (반투명 fill) — 외곽선보다 먼저 추가해 z-order 가 아래
        hatch = msp.add_hatch(color=color_idx, dxfattribs={"layer": layer})
        hatch.paths.add_polyline_path(pts_mm, is_closed=True)
        # transparency: 0=불투명, 1=완전투명. ezdxf 1.x 의 property setter 사용.
        try:
            hatch.transparency = max(0.0, min(1.0, hatch_transparency))
        except AttributeError:
            # 일부 ezdxf 빌드 호환 — transparency 미지원이면 솔리드 그대로 두고 진행
            pass

        # 3) 폐다각형 LWPOLYLINE — hatch 위에 외곽선
        msp.add_lwpolyline(
            pts_mm,
            close=True,
            dxfattribs={"layer": layer},
        )

        # 4) 다각형 중심에 fbld_name 텍스트. shrink 된 다각형 기준 centroid.
        # STYLE="HANGUL" 적용으로 malgun.ttf 폰트 사용 → AutoCAD 에서 한글 정상 렌더.
        cx, cy = _polygon_centroid(pts_mm)
        diag = _bbox_diag(pts_mm)
        height = max(diag * 0.03, 100.0)
        text = msp.add_text(
            a.fbld_name or "",
            dxfattribs={"layer": "TEXT", "height": height, "style": "HANGUL"},
        )
        text.set_placement((cx, cy), align=TextEntityAlignment.MIDDLE_CENTER)

    buf = StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")
