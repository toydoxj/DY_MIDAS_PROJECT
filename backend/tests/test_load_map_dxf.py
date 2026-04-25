"""Load Map DXF 직렬화 테스트.

실행:
    cd backend && ../.venv/Scripts/python -m pytest tests/test_load_map_dxf.py -v
"""

from __future__ import annotations

import os
import sys

import pytest

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
for _p in (_BACKEND_DIR, _PROJECT_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import ezdxf

from engines.load_map_dxf import (
    _sanitize_layer,
    _layer_color,
    build_load_map_dxf,
    polygon_inset,
)
from engines.slab_span import FloorLoadArea


# ──────────────────────────────────────────────────────────────
# Fixture: 3개 영역 (단위는 m 모델 가정)
# ──────────────────────────────────────────────────────────────

@pytest.fixture
def sample_areas() -> list[FloorLoadArea]:
    return [
        FloorLoadArea(
            fbld_name="사무실",
            polygon=((0.0, 0.0), (5.0, 0.0), (5.0, 4.0), (0.0, 4.0)),
            z_level=3.6,
            dl=4.9,
            ll=2.5,
        ),
        FloorLoadArea(
            fbld_name="계단",
            polygon=((5.0, 0.0), (8.0, 0.0), (8.0, 4.0), (5.0, 4.0)),
            z_level=3.6,
            dl=5.0,
            ll=5.0,
        ),
        FloorLoadArea(
            fbld_name="화장실",
            polygon=((0.0, 4.0), (8.0, 4.0), (8.0, 7.0), (0.0, 7.0)),
            z_level=7.2,  # 다른 층
            dl=5.3,
            ll=3.0,
        ),
    ]


# ──────────────────────────────────────────────────────────────
# Helper: bytes → readback 으로 검증
# ──────────────────────────────────────────────────────────────

def _read_back(dxf_bytes: bytes):
    """직렬화된 bytes 를 ezdxf 로 다시 파싱해 doc 객체 반환."""
    from io import StringIO

    text = dxf_bytes.decode("utf-8")
    return ezdxf.read(StringIO(text))


# ──────────────────────────────────────────────────────────────
# 단위 테스트
# ──────────────────────────────────────────────────────────────

def test_sanitize_layer_keeps_safe_chars():
    assert _sanitize_layer("DL_office-1") == "DL_office-1"
    assert _sanitize_layer("사무실") == "___"  # 한글 3자 → 모두 _
    assert _sanitize_layer("") == "UNNAMED"
    assert _sanitize_layer("a" * 200)[:80] == "a" * 80
    # 공백/특수문자 → _
    assert _sanitize_layer("LL load@2F") == "LL_load_2F"


def test_layer_color_consistency():
    # 같은 이름은 같은 색
    assert _layer_color("사무실") == _layer_color("사무실")
    # 빈 이름 → 7 (예약 색)
    assert _layer_color("") == 7
    # 컬러 출력 가능한 10번 이후 ACI 인덱스로 매핑
    expected = {30, 50, 90, 130, 150, 170, 210, 230}
    for n in ("DL", "LL", "사무실", "계단", "화장실", "기계실"):
        assert _layer_color(n) in expected


def test_dxf_basic_serialization(sample_areas):
    """3개 영역을 mm 단위(1배 변환) 로 DXF 직렬화 + 다시 읽기."""
    out = build_load_map_dxf(sample_areas, unit_to_mm=1.0)

    assert isinstance(out, bytes)
    assert len(out) > 0
    # DXF 텍스트 파일 헤더 시그니처
    head = out[:20].decode("utf-8", errors="replace")
    assert "SECTION" in head or "0" in head

    doc = _read_back(out)
    msp = doc.modelspace()
    polylines = list(msp.query("LWPOLYLINE"))
    texts = list(msp.query("TEXT"))

    assert len(polylines) == 3, f"기대 폴리라인 3개, 실제 {len(polylines)}"
    assert len(texts) == 3, f"기대 텍스트 3개, 실제 {len(texts)}"
    # closed 플래그 확인
    for pl in polylines:
        assert pl.dxf.flags & 1, "LWPOLYLINE 이 closed 가 아님"


def test_dxf_unit_conversion_meters_to_mm(sample_areas):
    """m 단위 모델(unit_to_mm=1000) → DXF 좌표는 mm 로 출력."""
    out = build_load_map_dxf(sample_areas, unit_to_mm=1000.0)
    doc = _read_back(out)
    msp = doc.modelspace()

    # $INSUNITS 헤더가 mm
    assert doc.header["$INSUNITS"] == 4

    # 첫 영역 (0..5m, 0..4m) → DXF 에서 (0..5000, 0..4000) mm
    polylines = list(msp.query("LWPOLYLINE"))
    pl0 = polylines[0]
    pts = [(p[0], p[1]) for p in pl0.get_points()]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    assert max(xs) == pytest.approx(5000.0, abs=1e-3)
    assert max(ys) == pytest.approx(4000.0, abs=1e-3)
    assert min(xs) == pytest.approx(0.0, abs=1e-3)
    assert min(ys) == pytest.approx(0.0, abs=1e-3)


def test_dxf_layer_separation_by_fbld(sample_areas):
    """fbld_name 별로 레이어 분리. 한글명도 sanitize 후 등록."""
    out = build_load_map_dxf(sample_areas, unit_to_mm=1.0)
    doc = _read_back(out)

    layer_names = {layer.dxf.name for layer in doc.layers}
    # FBLA_ 접두 + sanitize 결과
    assert "FBLA_" + _sanitize_layer("사무실") in layer_names
    assert "FBLA_" + _sanitize_layer("계단") in layer_names
    assert "FBLA_" + _sanitize_layer("화장실") in layer_names
    assert "TEXT" in layer_names

    # 컬러 출력용 10번 이후 ACI 또는 7(예약)
    valid_colors = {30, 50, 90, 130, 150, 170, 210, 230, 7}
    for name in layer_names:
        if name.startswith("FBLA_"):
            color = doc.layers.get(name).color
            assert color in valid_colors, f"{name} color={color} not in palette"


def test_dxf_solid_hatch_per_polygon(sample_areas):
    """각 영역마다 솔리드 해치가 폴리라인과 함께 생성되어야 함."""
    out = build_load_map_dxf(sample_areas, unit_to_mm=1.0)
    doc = _read_back(out)
    msp = doc.modelspace()

    hatches = list(msp.query("HATCH"))
    polylines = list(msp.query("LWPOLYLINE"))
    assert len(hatches) == 3, f"기대 해치 3개, 실제 {len(hatches)}"
    assert len(polylines) == 3
    # 솔리드 fill 인지 (pattern_name == "SOLID")
    for h in hatches:
        assert h.dxf.solid_fill == 1


def test_dxf_hatch_transparency():
    """transparency 가 0.5 로 적용되는지 (정확치 매칭은 ezdxf 정수 인코딩 때문에 근사 비교)."""
    areas = [FloorLoadArea(
        fbld_name="X", polygon=((0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)),
        z_level=0.0, dl=1.0, ll=1.0,
    )]
    out = build_load_map_dxf(areas, unit_to_mm=1.0, hatch_transparency=0.5)
    doc = _read_back(out)
    h = next(iter(doc.modelspace().query("HATCH")))
    # ezdxf 1.4: hatch.transparency property — 0~1 float
    t = h.transparency
    assert 0.45 <= t <= 0.55, f"transparency={t} (기대 ~0.5)"


def test_dxf_shrink_inset(sample_areas):
    """shrink_mm 가 적용되면 폴리라인 정점이 안쪽으로 이동."""
    # m 모델 → mm 변환 1000, shrink 200mm
    out_no = build_load_map_dxf(sample_areas, unit_to_mm=1000.0, shrink_mm=0.0)
    out_in = build_load_map_dxf(sample_areas, unit_to_mm=1000.0, shrink_mm=200.0)

    def _xs(buf):
        d = _read_back(buf)
        # 첫 영역 (0..5000mm × 0..4000mm) 의 x 범위
        pl = next(iter(d.modelspace().query("LWPOLYLINE")))
        pts = [(p[0], p[1]) for p in pl.get_points()]
        return min(p[0] for p in pts), max(p[0] for p in pts)

    x0_no, x1_no = _xs(out_no)
    x0_in, x1_in = _xs(out_in)
    # 원본은 0~5000, shrink 후엔 양쪽으로 200mm 안쪽 → 200~4800
    assert x0_no < x0_in < x1_in < x1_no
    assert abs((x0_in - x0_no) - 200.0) < 1.0
    assert abs((x1_no - x1_in) - 200.0) < 1.0


def test_dxf_shrink_too_large_skips_polygon():
    """영역 크기보다 큰 shrink 는 해당 다각형을 스킵 (LWPOLYLINE/HATCH 0개)."""
    tiny = [FloorLoadArea(
        fbld_name="tiny", polygon=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)),
        z_level=0.0, dl=1.0, ll=1.0,
    )]
    # 1×1 영역에 inset 5 → 사라져야 함
    out = build_load_map_dxf(tiny, unit_to_mm=1.0, shrink_mm=5.0)
    doc = _read_back(out)
    msp = doc.modelspace()
    assert len(list(msp.query("LWPOLYLINE"))) == 0
    assert len(list(msp.query("HATCH"))) == 0


def test_dxf_z_level_filter(sample_areas):
    """z_level 지정 시 해당 층만 추출."""
    # z=3.6 만 (영역 2개)
    out = build_load_map_dxf(sample_areas, unit_to_mm=1.0, z_level=3.6, z_tol=0.1)
    doc = _read_back(out)
    polylines = list(doc.modelspace().query("LWPOLYLINE"))
    assert len(polylines) == 2

    # z=7.2 만 (영역 1개)
    out2 = build_load_map_dxf(sample_areas, unit_to_mm=1.0, z_level=7.2, z_tol=0.1)
    doc2 = _read_back(out2)
    polylines2 = list(doc2.modelspace().query("LWPOLYLINE"))
    assert len(polylines2) == 1


def test_dxf_korean_text_preserved(sample_areas):
    """한글 fbld_name 은 TEXT 엔티티에 원본 그대로 들어가야 함."""
    out = build_load_map_dxf(sample_areas, unit_to_mm=1.0)
    doc = _read_back(out)
    texts = {t.dxf.text for t in doc.modelspace().query("TEXT")}

    assert "사무실" in texts
    assert "계단" in texts
    assert "화장실" in texts


def test_dxf_korean_style_registered(sample_areas):
    """한글 렌더링용 HANGUL STYLE(malgun.ttf)이 등록되고 모든 TEXT 가 사용해야 함."""
    out = build_load_map_dxf(sample_areas, unit_to_mm=1.0)
    doc = _read_back(out)
    style_names = {s.dxf.name for s in doc.styles}
    assert "HANGUL" in style_names
    hangul = doc.styles.get("HANGUL")
    # font 속성에 malgun.ttf 가 들어 있어야 (대소문자 무관)
    assert "malgun" in (hangul.dxf.font or "").lower()
    # 모든 TEXT 가 HANGUL STYLE 사용
    for t in doc.modelspace().query("TEXT"):
        assert t.dxf.style == "HANGUL"


def test_dxf_skips_invalid_polygon():
    """3점 미만 다각형은 무시되어야 함."""
    invalid_areas = [
        FloorLoadArea(
            fbld_name="invalid", polygon=((0.0, 0.0), (1.0, 0.0)),
            z_level=0.0, dl=1.0, ll=1.0,
        ),
        FloorLoadArea(
            fbld_name="empty", polygon=(),
            z_level=0.0, dl=1.0, ll=1.0,
        ),
    ]
    out = build_load_map_dxf(invalid_areas, unit_to_mm=1.0)
    doc = _read_back(out)
    polylines = list(doc.modelspace().query("LWPOLYLINE"))
    assert len(polylines) == 0


def test_polygon_inset_basic():
    """4×4 정사각형을 1만큼 inset → 2×2 정사각형."""
    poly = [(0.0, 0.0), (4.0, 0.0), (4.0, 4.0), (0.0, 4.0)]
    out = polygon_inset(poly, 1.0)
    assert len(out) == 4
    xs = sorted(p[0] for p in out)
    ys = sorted(p[1] for p in out)
    assert abs(xs[0] - 1.0) < 1e-6 and abs(xs[-1] - 3.0) < 1e-6
    assert abs(ys[0] - 1.0) < 1e-6 and abs(ys[-1] - 3.0) < 1e-6


def test_polygon_inset_zero_or_negative():
    poly = [(0.0, 0.0), (4.0, 0.0), (4.0, 4.0), (0.0, 4.0)]
    assert polygon_inset(poly, 0.0) == poly
    assert polygon_inset(poly, -1.0) == poly


def test_dxf_empty_areas():
    """빈 입력도 정상적인 (빈) DXF 를 생성."""
    out = build_load_map_dxf([], unit_to_mm=1.0)
    assert isinstance(out, bytes)
    assert len(out) > 0
    doc = _read_back(out)
    polylines = list(doc.modelspace().query("LWPOLYLINE"))
    assert len(polylines) == 0
