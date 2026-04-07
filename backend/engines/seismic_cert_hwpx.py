"""구조안전 및 내진설계 확인서 hwpx 생성 엔진

hwpx 파일(zip 기반)의 Contents/section0.xml을 파싱하여
테이블 셀 좌표에 데이터를 삽입하고 재압축한다.
"""

import io
import os
import sys
import zipfile
from xml.etree import ElementTree as ET

from models.seismic_cert import SeismicCertAutoData, SeismicCertManualData

# XML 네임스페이스
_NS = {
    "hp": "http://www.hancom.co.kr/hwpml/2011/paragraph",
    "hs": "http://www.hancom.co.kr/hwpml/2011/section",
    "hc": "http://www.hancom.co.kr/hwpml/2011/core",
}

# 네임스페이스 등록 (출력 시 ns0, ns1 대신 원래 접두사 유지)
for prefix, uri in _NS.items():
    ET.register_namespace(prefix, uri)
# 추가 네임스페이스도 등록
_EXTRA_NS = {
    "ha": "http://www.hancom.co.kr/hwpml/2011/app",
    "hp10": "http://www.hancom.co.kr/hwpml/2016/paragraph",
    "hh": "http://www.hancom.co.kr/hwpml/2011/head",
    "hhs": "http://www.hancom.co.kr/hwpml/2011/history",
    "hm": "http://www.hancom.co.kr/hwpml/2011/master-page",
    "hpf": "http://www.hancom.co.kr/schema/2011/hpf",
    "dc": "http://purl.org/dc/elements/1.1/",
    "opf": "http://www.idpf.org/2007/opf/",
    "ooxmlchart": "http://www.hancom.co.kr/hwpml/2016/ooxmlchart",
    "hwpunitchar": "http://www.hancom.co.kr/hwpml/2016/HwpUnitChar",
    "epub": "http://www.idpf.org/2007/ops",
    "config": "urn:oasis:names:tc:opendocument:xmlns:config:1.0",
}
for prefix, uri in _EXTRA_NS.items():
    ET.register_namespace(prefix, uri)


def _get_template_path(form_type: str) -> str:
    """양식 파일 경로 반환"""
    if getattr(sys, "frozen", False):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.dirname(__file__))

    data_dir = os.path.join(base, "data") if not getattr(sys, "frozen", False) else os.path.join(base, "data")

    if form_type == "6층이상":
        fname = "[별지 제1호서식] 구조안전 및 내진설계 확인서(6층 이상의 건축물)(건축물의 구조기준 등에 관한 규칙).hwpx"
    else:
        fname = "[별지 제2호서식] 구조안전 및 내진설계 확인서(5층 이하의 건축물 등)(건축물의 구조기준 등에 관한 규칙).hwpx"

    return os.path.join(data_dir, fname)


def _find_cell(tbl: ET.Element, row: int, col: int) -> ET.Element | None:
    """테이블에서 특정 좌표의 셀(hp:tc)을 찾는다"""
    for tr in tbl.findall("hp:tr", _NS):
        for tc in tr.findall("hp:tc", _NS):
            addr = tc.find("hp:cellAddr", _NS)
            if addr is not None:
                r = int(addr.get("rowAddr", "-1"))
                c = int(addr.get("colAddr", "-1"))
                if r == row and c == col:
                    return tc
    return None


def _set_cell_text(tc: ET.Element, text: str):
    """셀의 텍스트를 설정한다. 기존 <hp:t> 태그의 내용을 교체."""
    if tc is None:
        return

    hp_t = f"{{{_NS['hp']}}}t"

    # 셀 내의 모든 <hp:t> 태그 찾기
    t_elements = list(tc.iter(hp_t))
    if t_elements:
        # 첫 번째 <hp:t>에 텍스트 설정, 나머지는 비움
        t_elements[0].text = text
        for t_elem in t_elements[1:]:
            t_elem.text = ""
    else:
        # <hp:t>가 없으면 적절한 위치에 생성
        # hp:subList > hp:p > hp:run > hp:t 구조
        sub_list = tc.find("hp:subList", _NS)
        if sub_list is not None:
            p = sub_list.find("hp:p", _NS)
            if p is not None:
                runs = p.findall("hp:run", _NS)
                if runs:
                    t_elem = ET.SubElement(runs[-1], hp_t)
                    t_elem.text = text


def _append_cell_text(tc: ET.Element, text: str):
    """셀의 기존 텍스트 뒤에 추가 텍스트를 삽입한다."""
    if tc is None:
        return

    hp_t = f"{{{_NS['hp']}}}t"
    t_elements = list(tc.iter(hp_t))
    if t_elements:
        # 첫 번째 비어있지 않은 <hp:t>를 찾아 뒤에 추가
        for t_elem in t_elements:
            if t_elem.text and t_elem.text.strip():
                t_elem.text = t_elem.text.rstrip() + text
                return
        # 모두 비어있으면 첫 번째에 설정
        t_elements[0].text = text


def _build_cell_map_5floor(auto: SeismicCertAutoData, manual: SeismicCertManualData) -> dict[tuple[int, int], str]:
    """5층이하 양식 셀 좌표 → 데이터 매핑"""
    cat = manual.seismic_category_override or auto.seismic_category

    # 층수 표기
    floors_str = f"지상 {auto.above_floors}층"
    if auto.below_floors > 0:
        floors_str += f" / 지하 {auto.below_floors}층"
    height_str = f"{auto.actual_height}" if auto.actual_height else f"{auto.total_height:.1f}"

    return {
        # 1) 공사명
        (2, 1): auto.project_name,
        # 2) 대지위치 / 지역계수
        (3, 1): f"{auto.address} / {auto.zone_factor}",
        # 3) 용도
        (4, 1): manual.usage,
        # 4) 중요도
        (5, 1): auto.importance,
        # 5) 규모
        (6, 2): f"{auto.floor_area} m\u00b2" if auto.floor_area else "",
        (6, 4): floors_str,
        (6, 6): f"/ ({height_str} m)" if height_str else "",
        # 6) 사용설계기준
        (7, 1): manual.design_code or auto.design_code,
        # 7) 구조계획
        (8, 1): manual.struct_plan or auto.struct_type_x,
        # 8) 지반 및 기초
        (9, 3): auto.sc_label,
        (9, 7): manual.ground_water_level,
        (10, 1): manual.foundation_type,
        (11, 3): f"fe= {manual.design_bearing} t/m\u00b2" if manual.design_bearing else "",
        (11, 7): f"fp = {manual.pile_capacity} ton" if manual.pile_capacity else "",
        # 9) 내진설계 개요
        (12, 3): cat,
        (13, 3): manual.analysis_method,
        (14, 3): f"{auto.ie}",
        (14, 7): f"W= {auto.total_weight:.1f} kN" if auto.total_weight else "",
        # 10) 기본 지진력 저항시스템
        (16, 3): manual.sfrs_x_detail or auto.sfrs_x,
        (16, 6): manual.sfrs_y_detail or auto.sfrs_y,
        (17, 3): f"{auto.r_x}",
        (17, 6): f"{auto.r_y}",
        (18, 3): f"\u0394ax = {manual.allowable_drift or auto.allowable_drift}",
        # 11) 내진설계 주요결과
        (19, 3): f"Csx= {auto.csx:.4f}" if auto.csx else "",
        (19, 6): f"Csy= {auto.csy:.4f}" if auto.csy else "",
        (20, 3): f"Vsx= {auto.vsx:.1f} kN" if auto.vsx else "",
        (20, 6): f"Vsy= {auto.vsy:.1f} kN" if auto.vsy else "",
        (21, 3): f"Tax= {auto.tax:.4f} sec" if auto.tax else "",
        (21, 6): f"Tay= {auto.tay:.4f} sec" if auto.tay else "",
        (22, 3): manual.max_drift_x,
        (22, 6): manual.max_drift_y,
        # 12) 구조요소 내진설계 검토사항
        (23, 6): manual.has_piloti,
        (24, 6): manual.has_out_of_plane,
        (25, 6): manual.has_lateral_discontinuity,
        (26, 6): manual.has_vertical_discontinuity,
        # 13) 비구조요소
        (27, 3): manual.arch_non_structural,
        (28, 3): manual.mech_non_structural,
        # 14) 특이사항
        (29, 1): manual.special_notes,
    }


def _build_cell_map_6floor(auto: SeismicCertAutoData, manual: SeismicCertManualData) -> dict[tuple[int, int], str]:
    """6층이상 양식 셀 좌표 → 데이터 매핑"""
    cat = manual.seismic_category_override or auto.seismic_category

    floors_str = f"지상 {auto.above_floors}층"
    if auto.below_floors > 0:
        floors_str += f" / 지하 {auto.below_floors}층"
    height_str = f"{auto.actual_height}" if auto.actual_height else f"{auto.total_height:.1f}"

    return {
        # 1) 공사명
        (2, 1): auto.project_name,
        # 2) 대지위치 / 지역계수
        (3, 1): f"{auto.address} / {auto.zone_factor}",
        # 3) 용도
        (4, 1): manual.usage,
        # 4) 중요도
        (5, 1): auto.importance,
        # 5) 규모
        (6, 2): f"{auto.floor_area} m\u00b2" if auto.floor_area else "",
        (6, 6): floors_str,
        (6, 9): f"/ ({height_str} m)" if height_str else "",
        # 6) 사용설계기준
        (7, 1): manual.design_code or auto.design_code,
        # 7) 구조계획
        (8, 1): manual.struct_plan or auto.struct_type_x,
        # 8) 지반 및 기초
        (9, 4): auto.sc_label,
        (9, 9): manual.ground_water_level,
        (10, 1): manual.foundation_type,
        (11, 4): f"fe= {manual.design_bearing} t/m\u00b2" if manual.design_bearing else "",
        (11, 9): f"fp = {manual.pile_capacity} ton" if manual.pile_capacity else "",
        # 9) 풍하중 개요 (6층 전용)
        (12, 4): manual.basic_wind_speed,
        (12, 9): manual.wind_exposure,
        (13, 4): manual.gust_factor,
        (13, 9): manual.wind_importance,
        # 10) 풍하중 해석결과
        (15, 4): manual.max_story_disp_x,
        (15, 8): manual.max_story_disp_y,
        (16, 4): manual.max_story_drift_x,
        (16, 8): manual.max_story_drift_y,
        # 11) 내진설계 개요
        (18, 4): cat,
        (19, 4): manual.analysis_method,
        (20, 4): f"{auto.ie}",
        (20, 10): f"W= {auto.total_weight:.1f} kN" if auto.total_weight else "",
        # 12) 기본 지진력 저항시스템
        (22, 4): manual.sfrs_x_detail or auto.sfrs_x,
        (22, 8): manual.sfrs_y_detail or auto.sfrs_y,
        (23, 4): f"Rx= {auto.r_x}",
        (23, 8): f"Ry= {auto.r_y}",
        (24, 4): f"\u03A9ox= ",
        (24, 8): f"\u03A9oy= ",
        (25, 4): f"Cdx= ",
        (25, 8): f"Cdy= ",
        (26, 4): f"\u0394ax = {manual.allowable_drift or auto.allowable_drift}",
        # 13) 내진설계 주요결과
        (28, 4): f"Csx= {auto.csx:.4f}" if auto.csx else "",
        (28, 8): f"Csy= {auto.csy:.4f}" if auto.csy else "",
        (29, 4): f"Vsx= {auto.vsx:.1f} kN" if auto.vsx else "",
        (29, 8): f"Vsy= {auto.vsy:.1f} kN" if auto.vsy else "",
        (30, 4): f"Tax= {auto.tax:.4f} sec" if auto.tax else "",
        (30, 8): f"Tay= {auto.tay:.4f} sec" if auto.tay else "",
        (31, 4): manual.max_drift_x,
        (31, 8): manual.max_drift_y,
        # 14) 모드 해석 결과 (6층 전용) - 자동수집 우선, 수동 오버라이드 가능
        (33, 4): manual.mode1_period or (f"{auto.mode1_period:.4f}" if auto.mode1_period else ""),
        (33, 8): manual.mode1_mass_ratio or (f"{auto.mode1_mass_ratio:.1f}" if auto.mode1_mass_ratio else ""),
        (34, 4): manual.mode2_period or (f"{auto.mode2_period:.4f}" if auto.mode2_period else ""),
        (34, 8): manual.mode2_mass_ratio or (f"{auto.mode2_mass_ratio:.1f}" if auto.mode2_mass_ratio else ""),
        (35, 4): manual.mode3_period or (f"{auto.mode3_period:.4f}" if auto.mode3_period else ""),
        (35, 8): manual.mode3_mass_ratio or (f"{auto.mode3_mass_ratio:.1f}" if auto.mode3_mass_ratio else ""),
        # 15) 구조요소 내진설계 검토사항
        (36, 8): manual.has_piloti,
        (37, 8): manual.has_out_of_plane,
        (38, 8): manual.has_lateral_discontinuity,
        (39, 8): manual.has_vertical_discontinuity,
        # 16) 비구조요소
        (40, 5): manual.arch_non_structural,
        (41, 5): manual.mech_non_structural,
        # 17) 특이사항
        (42, 1): manual.special_notes,
    }


def generate_hwpx(auto: SeismicCertAutoData, manual: SeismicCertManualData, form_type: str) -> bytes:
    """hwpx 템플릿에 데이터를 삽입하여 새 hwpx 바이트를 반환"""
    template_path = _get_template_path(form_type)
    if not os.path.isfile(template_path):
        raise FileNotFoundError(f"양식 파일을 찾을 수 없습니다: {template_path}")

    # 셀 매핑 생성
    if form_type == "6층이상":
        cell_map = _build_cell_map_6floor(auto, manual)
    else:
        cell_map = _build_cell_map_5floor(auto, manual)

    # hwpx 읽기 → section0.xml 수정 → 재압축
    output = io.BytesIO()

    with zipfile.ZipFile(template_path, "r") as zin:
        section_xml = zin.read("Contents/section0.xml").decode("utf-8")
        root = ET.fromstring(section_xml)

        # 테이블 찾기
        tbl = root.find(".//hp:tbl", _NS)
        if tbl is None:
            raise ValueError("양식에서 테이블을 찾을 수 없습니다")

        # 셀에 데이터 삽입
        for (row, col), text in cell_map.items():
            if not text:
                continue
            tc = _find_cell(tbl, row, col)
            if tc is not None:
                _set_cell_text(tc, str(text))

        # 수정된 XML을 문자열로 변환
        modified_xml = ET.tostring(root, encoding="unicode", xml_declaration=True)

        # 새 hwpx 파일 생성
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == "Contents/section0.xml":
                    zout.writestr(item, modified_xml.encode("utf-8"))
                else:
                    zout.writestr(item, zin.read(item.filename))

    return output.getvalue()
