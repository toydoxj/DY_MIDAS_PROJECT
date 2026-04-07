import io
import json
import os
import re
import sys

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import MIDAS_API as MIDAS

from exceptions import MidasApiError
from models.seismic_cert import SeismicCertAutoData, SeismicCertRequest

router = APIRouter()

# 지반분류 코드 → 라벨 매핑
_SC_LABELS: dict[int, str] = {1: "S1", 2: "S2", 3: "S3", 4: "S4", 5: "S5"}

# SFRS 코드 → (시스템명, R, Ω₀, Cd) 매핑 (KDS 41 17 00:2022 표 6.2-1)
_SFRS_TABLE: dict[str, tuple[str, float, float, float]] = {
    "1-a": ("철근콘크리트 특수전단벽", 5, 2.5, 5),
    "1-b": ("철근콘크리트 보통전단벽", 4, 2.5, 4),
    "2-a": ("철골 편심가새골조 (모멘트저항접합)", 8, 2, 4),
    "2-c": ("철골 특수중심가새골조", 6, 2, 5),
    "2-d": ("철골 보통중심가새골조", 3.25, 2, 3.25),
    "2-l": ("철골 좌굴방지가새골조 (모멘트저항접합)", 8, 2.5, 5),
    "2-n": ("철근콘크리트 특수전단벽 (건물골조)", 6, 2.5, 5),
    "2-o": ("철근콘크리트 보통전단벽 (건물골조)", 5, 2.5, 4.5),
    "3-a": ("철골 특수모멘트골조", 8, 3, 5.5),
    "3-b": ("철골 중간모멘트골조", 4.5, 3, 4),
    "3-c": ("철골 보통모멘트골조", 3.5, 3, 3),
    "3-h": ("철근콘크리트 특수모멘트골조", 8, 3, 5.5),
    "3-i": ("철근콘크리트 중간모멘트골조", 5, 3, 4.5),
    "3-j": ("철근콘크리트 보통모멘트골조", 3, 3, 2.5),
    "4-a": ("이중: 철골 편심가새골조 (특수모멘트)", 8, 2.5, 4),
    "4-j": ("이중: 철근콘크리트 특수전단벽 (특수모멘트)", 7, 2.5, 5.5),
    "4-k": ("이중: 철근콘크리트 보통전단벽 (특수모멘트)", 6, 2.5, 5),
    "5-b": ("이중: 철근콘크리트 특수전단벽 (중간모멘트)", 6.5, 2.5, 5),
    "5-c": ("이중: 철근콘크리트 보통전단벽 (중간모멘트)", 5.5, 2.5, 4.5),
    "8": ("강구조기준 일반규정 철골구조", 3, 3, 3),
    "9": ("철근콘크리트구조기준 일반규정 RC구조", 3, 3, 3),
}

# 허용층간변위 자동 결정 (중요도 기반)
_ALLOWABLE_DRIFT: dict[str, str] = {
    "특": "0.010hs",
    "(1)": "0.015hs",
    "(2)": "0.020hs",
    "(3)": "0.020hs",
}

# 구조형식 코드 → 라벨
_STRUCT_TYPE_LABELS: dict[int, str] = {
    0: "철근콘크리트 구조",
    1: "철골 구조",
    2: "철골철근콘크리트 구조",
    3: "조적 구조",
}


def _calc_seismic_category(sds: float, importance: str) -> str:
    """KDS 41 17 00 기준 내진설계범주 계산"""
    if importance in ("특", "(1)"):
        if sds < 0.167:
            return "B"
        elif sds < 0.33:
            return "C"
        elif sds < 0.50:
            return "D"
        else:
            return "D"
    else:
        if sds < 0.167:
            return "A"
        elif sds < 0.33:
            return "B"
        elif sds < 0.50:
            return "C"
        else:
            return "D"


def _count_floors(stor: dict) -> tuple[int, int]:
    """STOR 데이터에서 지상층수, 지하층수 계산"""
    above = 0
    below = 0
    for val in stor.values():
        if not isinstance(val, dict):
            continue
        name: str = val.get("STORY_NAME", "")
        if re.match(r"^\d+F$", name, re.IGNORECASE):
            above += 1
        elif re.match(r"^B\d+F$", name, re.IGNORECASE):
            below += 1
    return above, below


@router.get("/seismic-cert/auto")
def get_seismic_cert_auto() -> SeismicCertAutoData:
    """MIDAS API에서 구조안전확인서에 필요한 데이터를 통합 조회"""
    result = SeismicCertAutoData()

    # 1. 프로젝트 정보
    try:
        raw: dict = MIDAS.projectDB.get()
        pjcf: dict = raw.get("PJCF", {})
        data: dict = next(iter(pjcf.values()), {}) if pjcf else {}
        result.project_name = data.get("PROJECT", "")
        result.address = data.get("ADDRESS", "")

        comment_str: str = data.get("COMMENT", "")
        if comment_str:
            try:
                comment = json.loads(comment_str)
                result.importance = comment.get("IMPORTANCE", "")
                result.floor_area = float(comment.get("FLOOR_AREA", 0) or 0)
                result.actual_height = float(comment.get("ACTUAL_HEIGHT", 0) or 0)
                struct_x = comment.get("STRUCT_TYPE_X", "")
                struct_y = comment.get("STRUCT_TYPE_Y", "")
                if isinstance(struct_x, int):
                    result.struct_type_x = _STRUCT_TYPE_LABELS.get(struct_x, str(struct_x))
                else:
                    result.struct_type_x = str(struct_x) if struct_x else ""
                if isinstance(struct_y, int):
                    result.struct_type_y = _STRUCT_TYPE_LABELS.get(struct_y, str(struct_y))
                else:
                    result.struct_type_y = str(struct_y) if struct_y else ""
                sfrs_x_id = comment.get("SFRS_X", "")
                sfrs_y_id = comment.get("SFRS_Y", "")
                sfrs_x_entry = _SFRS_TABLE.get(sfrs_x_id)
                sfrs_y_entry = _SFRS_TABLE.get(sfrs_y_id)
                result.sfrs_x = sfrs_x_entry[0] if sfrs_x_entry else sfrs_x_id
                result.sfrs_y = sfrs_y_entry[0] if sfrs_y_entry else sfrs_y_id
                if sfrs_x_entry:
                    result.r_x = sfrs_x_entry[1]
                if sfrs_y_entry:
                    result.r_y = sfrs_y_entry[1]
            except (json.JSONDecodeError, ValueError):
                pass
    except Exception:
        pass

    # 2. STOR → 층수, 높이
    try:
        stor_raw: dict = MIDAS.MidasAPI("GET", "/db/STOR")
        stor: dict = stor_raw.get("STOR", {})
        above, below = _count_floors(stor)
        result.above_floors = above
        result.below_floors = below

        levels = [v["STORY_LEVEL"] for v in stor.values() if isinstance(v, dict) and "STORY_LEVEL" in v]
        result.total_height = max(levels) if levels else 0.0
    except Exception:
        pass

    # 3. SPFC → 지진 파라미터
    try:
        spfc_raw: dict = MIDAS.MidasAPI("GET", "/db/SPFC")
        spfc: dict = spfc_raw.get("SPFC", {})
        first_spfc = next((v for v in spfc.values() if isinstance(v, dict)), {})
        if first_spfc:
            val_data: dict = first_spfc.get("VAL", {})
            opt_data: dict = first_spfc.get("OPT", {})
            str_data: dict = first_spfc.get("STR", {})
            a_sra: list = val_data.get("aSRA", [0, 0])
            a_scp: list = val_data.get("aSCP", [0, 0])

            result.spec_code = str_data.get("SPEC_CODE", "")
            result.zone_factor = val_data.get("ZONEFACTOR", 0)
            result.sc = opt_data.get("SC_", 0)
            result.sc_label = _SC_LABELS.get(result.sc, f"S{result.sc}")
            result.ie = val_data.get("IE", 0)
            result.r_x = val_data.get("R_", 0)
            result.r_y = val_data.get("R_", 0)
            result.sds = a_sra[0] if len(a_sra) > 0 else 0
            result.sd1 = a_sra[1] if len(a_sra) > 1 else 0
    except Exception:
        pass

    # 4. story-weight → 건물유효중량
    try:
        splc_raw: dict = MIDAS.MidasAPI("GET", "/db/SPLC")
        splc: dict = splc_raw.get("SPLC", {})
        lc_names: list[str] = [f"{v['NAME']}(RS)" for v in splc.values() if isinstance(v, dict) and "NAME" in v]
        if not lc_names:
            lc_names = ["RX(RS)", "RY(RS)"]

        body = {
            "Argument": {
                "TABLE_NAME": "StoryShearCoeff",
                "TABLE_TYPE": "STORY_SHEAR_FORCE_COEFFICIENT",
                "UNIT": {"FORCE": "kN", "DIST": "m"},
                "STYLES": {"FORMAT": "Fixed", "PLACE": 12},
                "LOAD_CASE_NAMES": lc_names,
            }
        }
        raw = MIDAS.MidasAPI("POST", "/post/TABLE", body)
        inner = next((v for v in raw.values() if isinstance(v, dict) and "HEAD" in v), {})
        head: list[str] = inner.get("HEAD", [])
        data_rows: list[list] = inner.get("DATA", [])
        idx = {h: i for i, h in enumerate(head)}

        # GL층 찾기
        stor_raw2: dict = MIDAS.MidasAPI("GET", "/db/STOR")
        stor2: dict = stor_raw2.get("STOR", {})
        stor_list = [(v["STORY_NAME"], v["STORY_LEVEL"]) for v in stor2.values() if isinstance(v, dict)]
        gl_entry = min(stor_list, key=lambda x: abs(x[1]))
        gl_story = gl_entry[0]

        first_lc = lc_names[0] if lc_names else ""
        i_story = idx.get("Story", 1)
        i_spectrum = idx.get("Spectrum", 2)
        i_weight_x = idx.get("Weight Sum/X", 5)
        gl_row = next((r for r in data_rows if r[i_spectrum] == first_lc and r[i_story] == gl_story), None)
        if gl_row:
            result.total_weight = float(gl_row[i_weight_x])
    except Exception:
        pass

    # 5. story-shear → 밑면전단력
    try:
        body = {
            "Argument": {
                "TABLE_NAME": "StoryShear",
                "TABLE_TYPE": "STORY_SHEAR_FOR_RS",
                "UNIT": {"FORCE": "kN", "DIST": "m"},
                "STYLES": {"FORMAT": "Fixed", "PLACE": 12},
                "LOAD_CASE_NAMES": lc_names,
            }
        }
        raw = MIDAS.MidasAPI("POST", "/post/TABLE", body)
        inner = next((v for v in raw.values() if isinstance(v, dict) and "HEAD" in v), {})
        head = inner.get("HEAD", [])
        data_rows = inner.get("DATA", [])
        idx = {h: i for i, h in enumerate(head)}
        i_story = idx.get("Story", 1)
        i_spectrum = idx.get("Spectrum", 3)
        i_shear_x = idx.get("Shear Force/With Spring/X", 10)
        i_shear_y = idx.get("Shear Force/With Spring/Y", 11)

        # GL층의 전단력 = 밑면전단력
        if len(lc_names) >= 2:
            rx_row = next((r for r in data_rows if r[i_spectrum] == lc_names[0] and r[i_story] == gl_story), None)
            ry_row = next((r for r in data_rows if r[i_spectrum] == lc_names[1] and r[i_story] == gl_story), None)
            if rx_row:
                result.vsx = abs(float(rx_row[i_shear_x]))
            if ry_row:
                result.vsy = abs(float(ry_row[i_shear_y]))
    except Exception:
        pass

    # 6. eigenvalue → 고유주기
    periods_by_mode: dict[int, float] = {}
    mass_x_by_mode: dict[int, float] = {}
    mass_y_by_mode: dict[int, float] = {}
    try:
        eigv_raw: dict = MIDAS.MidasAPI("GET", "/db/EIGV")
        eigv_data: dict = eigv_raw.get("EIGV", {})
        first_val = next(iter(eigv_data.values()), {})
        num_modes: int = first_val.get("iFREQ", 21) if isinstance(first_val, dict) else 21
        modes_list: list[str] = [f"Mode{i}" for i in range(1, num_modes + 1)]

        body = {
            "Argument": {
                "TABLE_NAME": "EigenvalueMode",
                "TABLE_TYPE": "EIGENVALUEMODE",
                "UNIT": {"FORCE": "kN", "DIST": "m"},
                "STYLES": {"FORMAT": "Scientific", "PLACE": 12},
                "COMPONENTS": ["Node", "Mode", "UX", "UY", "UZ", "RX", "RY", "RZ"],
                "NODE_ELEMS": {"KEYS": [1]},
                "MODES": modes_list,
            }
        }
        raw = MIDAS.MidasAPI("POST", "/post/TABLE", body)
        inner = next((v for v in raw.values() if isinstance(v, dict) and "SUB_TABLES" in v), raw)
        sub_tables: list = inner.get("SUB_TABLES", [])

        if len(sub_tables) >= 2:
            # SUB_TABLE 1: 고유치 (Mode, Period)
            st1 = sub_tables[0]
            st1_table = next(iter(st1.values())) if isinstance(st1, dict) else st1
            st1_head = st1_table.get("HEAD", [])
            st1_data = st1_table.get("DATA", [])

            # SUB_TABLE 2: 질량참여율
            st2 = sub_tables[1]
            st2_table = next(iter(st2.values())) if isinstance(st2, dict) else st2
            st2_head = st2_table.get("HEAD", [])
            st2_data = st2_table.get("DATA", [])

            st1_idx = {h: i for i, h in enumerate(st1_head)}
            st2_idx = {h: i for i, h in enumerate(st2_head)}

            i_mode1 = st1_idx.get("ModeNo", 0)
            i_period = next((st1_idx[k] for k in ("Period(sec)", "Period(Sec)") if k in st1_idx), 1)
            i_mode2 = st2_idx.get("ModeNo", 0)
            i_mass_x = next((st2_idx[k] for k in ("TRAN-XMASS(%)", "TRAN-XMASS") if k in st2_idx), 1)
            i_mass_y = next((st2_idx[k] for k in ("TRAN-YMASS(%)", "TRAN-YMASS") if k in st2_idx), 2)

            # 모드별 주기와 질량참여율 병합
            for row in st1_data:
                m = int(float(str(row[i_mode1])))
                periods_by_mode[m] = float(row[i_period])

            for row in st2_data:
                m = int(float(str(row[i_mode2])))
                mass_x_by_mode[m] = float(row[i_mass_x])
                mass_y_by_mode[m] = float(row[i_mass_y])

            # X방향 최대 질량참여 모드 → Tax
            if mass_x_by_mode:
                max_x_mode = max(mass_x_by_mode, key=mass_x_by_mode.get)
                result.tax = periods_by_mode.get(max_x_mode, 0.0)

            # Y방향 최대 질량참여 모드 → Tay
            if mass_y_by_mode:
                max_y_mode = max(mass_y_by_mode, key=mass_y_by_mode.get)
                result.tay = periods_by_mode.get(max_y_mode, 0.0)
    except Exception:
        pass

    # 7. 자동 계산
    if result.total_weight > 0:
        result.csx = result.vsx / result.total_weight if result.vsx else 0.0
        result.csy = result.vsy / result.total_weight if result.vsy else 0.0

    result.seismic_category = _calc_seismic_category(result.sds, result.importance)
    result.form_type = "5층이하" if result.above_floors <= 5 else "6층이상"
    result.allowable_drift = _ALLOWABLE_DRIFT.get(result.importance, "0.020hs")

    # 8. 모드 해석 (상위 3개 모드 - 질량참여율 합산 기준 정렬)
    try:
        if mass_x_by_mode and mass_y_by_mode and periods_by_mode:
            # 질량참여율 합산(X+Y)으로 상위 3개 선택
            all_modes = set(mass_x_by_mode.keys()) | set(mass_y_by_mode.keys())
            mode_total = {m: mass_x_by_mode.get(m, 0) + mass_y_by_mode.get(m, 0) for m in all_modes}
            top3 = sorted(mode_total, key=mode_total.get, reverse=True)[:3]

            for i, mode in enumerate(top3):
                period = periods_by_mode.get(mode, 0.0)
                ratio = max(mass_x_by_mode.get(mode, 0), mass_y_by_mode.get(mode, 0))
                if i == 0:
                    result.mode1_period = period
                    result.mode1_mass_ratio = ratio
                elif i == 1:
                    result.mode2_period = period
                    result.mode2_mass_ratio = ratio
                elif i == 2:
                    result.mode3_period = period
                    result.mode3_mass_ratio = ratio
    except Exception:
        pass

    return result


@router.post("/seismic-cert/hwpx")
def generate_seismic_cert_hwpx(req: SeismicCertRequest):
    """구조안전 및 내진설계 확인서 hwpx 생성"""
    from engines.seismic_cert_hwpx import generate_hwpx

    form_type = req.auto_data.form_type
    if req.manual_data.seismic_category_override:
        req.auto_data.seismic_category = req.manual_data.seismic_category_override

    hwpx_bytes: bytes = generate_hwpx(req.auto_data, req.manual_data, form_type)

    from urllib.parse import quote
    filename = f"구조안전확인서_{form_type}.hwpx"
    encoded = quote(filename)
    return StreamingResponse(
        io.BytesIO(hwpx_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )
