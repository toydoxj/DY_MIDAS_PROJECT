import io
import json
import os
import re
import sys

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import MIDAS_API as MIDAS

from exceptions import MidasApiError
from engines.kds_seismic import (
    SFRS_TABLE, ALLOWABLE_DRIFT, STRUCT_TYPE_LABELS, STRUCT_PERIOD_COEFF,
    classify_soil, calc_cs, calc_seismic_category, calc_applied_period,
)
from models.seismic_cert import SeismicCertAutoData, SeismicCertRequest

router = APIRouter()

# 지반분류 코드 → 라벨 매핑
_SC_LABELS: dict[int, str] = {1: "S1", 2: "S2", 3: "S3", 4: "S4", 5: "S5"}


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

    # 프로젝트 COMMENT에서 추출할 값 (Step 7 계산에 사용)
    _vs: float = 0.0      # 전단파속도
    _h: float = 0.0       # 기반암깊이
    _struct_code_x: int = 0  # 구조형식 코드 (X)
    _struct_code_y: int = 0  # 구조형식 코드 (Y)

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
            except json.JSONDecodeError:
                comment = {}

            if comment:
                result.importance = comment.get("IMPORTANCE", "")
                # 콤마 포함 숫자 문자열 안전 변환
                try:
                    raw_fa = str(comment.get("FLOOR_AREA", "") or "").replace(",", "")
                    result.floor_area = float(raw_fa) if raw_fa else 0.0
                except (ValueError, TypeError):
                    pass
                try:
                    raw_ah = str(comment.get("ACTUAL_HEIGHT", "") or "").replace(",", "")
                    result.actual_height = float(raw_ah) if raw_ah else 0.0
                except (ValueError, TypeError):
                    pass

                # STRUCT_TYPE: int 또는 문자열 "0","1" 등으로 저장될 수 있음
                struct_x = comment.get("STRUCT_TYPE_X", "")
                struct_y = comment.get("STRUCT_TYPE_Y", "")
                try:
                    result.struct_type_x = STRUCT_TYPE_LABELS.get(int(struct_x), str(struct_x))
                except (ValueError, TypeError):
                    result.struct_type_x = str(struct_x) if struct_x else ""
                try:
                    result.struct_type_y = STRUCT_TYPE_LABELS.get(int(struct_y), str(struct_y))
                except (ValueError, TypeError):
                    result.struct_type_y = str(struct_y) if struct_y else ""

                # 전단파속도·기반암깊이 → 지반분류 계산용
                try:
                    _vs = float(str(comment.get("SHEAR_WAVE_VELOCITY", "") or "").replace(",", "") or "0")
                except (ValueError, TypeError):
                    _vs = 0.0
                try:
                    _h = float(str(comment.get("BEDROCK_DEPTH", "") or "").replace(",", "") or "0")
                except (ValueError, TypeError):
                    _h = 0.0

                # 구조형식 코드 (근사고유주기 계산용)
                try:
                    _struct_code_x = int(struct_x)
                except (ValueError, TypeError):
                    _struct_code_x = 0
                try:
                    _struct_code_y = int(struct_y)
                except (ValueError, TypeError):
                    _struct_code_y = 0

                # SFRS 테이블 조회 → R, Ω₀, Cd
                sfrs_x_id = str(comment.get("SFRS_X", "")).strip()
                sfrs_y_id = str(comment.get("SFRS_Y", "")).strip()
                sfrs_x_entry = SFRS_TABLE.get(sfrs_x_id)
                sfrs_y_entry = SFRS_TABLE.get(sfrs_y_id)
                result.sfrs_x = sfrs_x_entry[0] if sfrs_x_entry else sfrs_x_id
                result.sfrs_y = sfrs_y_entry[0] if sfrs_y_entry else sfrs_y_id
                if sfrs_x_entry:
                    result.r_x = sfrs_x_entry[1]
                    result.omega_x = sfrs_x_entry[2]
                    result.cd_x = sfrs_x_entry[3]
                if sfrs_y_entry:
                    result.r_y = sfrs_y_entry[1]
                    result.omega_y = sfrs_y_entry[2]
                    result.cd_y = sfrs_y_entry[3]
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
            # SFRS 테이블에서 R이 설정되지 않은 경우에만 SPFC의 R_ 사용
            spfc_r = val_data.get("R_", 0)
            if not result.r_x:
                result.r_x = spfc_r
            if not result.r_y:
                result.r_y = spfc_r
            result.sds = a_sra[0] if len(a_sra) > 0 else 0
            result.sd1 = a_sra[1] if len(a_sra) > 1 else 0

            # 프로젝트 정보(Vs, H)가 있으면 지반분류를 KDS 기준으로 재계산
            if _vs > 0 and _h > 0:
                calc_sc = classify_soil(_h, _vs)
                result.sc_label = calc_sc
                sc_map = {"S1": 1, "S2": 2, "S3": 3, "S4": 4, "S5": 5}
                result.sc = sc_map.get(calc_sc, result.sc)
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

    # 7. 등가정적 지진응답계수 (Cs) 및 밑면전단력 계산
    # 건물높이 결정 (실제높이 > STOR높이 > 0)
    hn = result.actual_height if result.actual_height > 0 else result.total_height

    if result.sds > 0 and result.ie > 0 and hn > 0:
        # 적용주기 T (근사고유주기 + Cu 상한 + 고유치 주기)
        t_x = calc_applied_period(hn, _struct_code_x, result.sd1, result.tax)
        t_y = calc_applied_period(hn, _struct_code_y, result.sd1, result.tay)

        # 등가정적 Cs
        result.csx = calc_cs(result.sds, result.sd1, result.r_x, result.ie, t_x)
        result.csy = calc_cs(result.sds, result.sd1, result.r_y, result.ie, t_y)

        # 등가정적 밑면전단력 V = Cs × W
        if result.total_weight > 0:
            result.vsx = result.csx * result.total_weight
            result.vsy = result.csy * result.total_weight

    result.seismic_category = calc_seismic_category(result.sds, result.importance)
    result.form_type = "5층이하" if result.above_floors <= 5 else "6층이상"
    result.allowable_drift = ALLOWABLE_DRIFT.get(result.importance, "0.020hs")

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
