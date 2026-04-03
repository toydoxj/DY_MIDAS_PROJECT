from fastapi import APIRouter
import MIDAS_API as MIDAS

from exceptions import MidasApiError
from models.analysis import SelfWeightRow, StructureMassResponse, LoadToMassResponse, EigenvalueRow, StoryShearRow, StoryWeightResponse

router = APIRouter()


@router.get("/selfweight")
def get_selfweight() -> list[SelfWeightRow]:
    """MIDAS GEN NX에서 Self-Weight(BODF) 정보를 가져와 반환"""
    try:
        raw: dict = MIDAS.selfWeightDB.get()
    except Exception as e:
        raise MidasApiError("Self-Weight 조회 실패", cause=str(e))

    bodf: dict = raw.get("BODF", {})
    rows: list[SelfWeightRow] = []
    for key, val in bodf.items():
        if not isinstance(val, dict):
            continue
        fv: list = val.get("FV", [])
        factor: float | None = fv[2] if len(fv) >= 3 else None
        valid: bool = (
            len(fv) == 3
            and fv[0] == 0
            and fv[1] == 0
            and isinstance(fv[2], (int, float))
            and fv[2] < 0
        )
        rows.append(SelfWeightRow(
            id=key,
            LCNAME=val.get("LCNAME", ""),
            GROUP_NAME=val.get("GROUP_NAME", ""),
            FV=fv,
            factor=factor,
            valid=valid,
        ))
    rows.sort(key=lambda r: int(r.id))
    return rows


@router.get("/structure-mass")
def get_structure_mass() -> StructureMassResponse:
    """MIDAS GEN NX에서 Structure Type(STYP) 정보를 가져와 Mass 관련 정보 반환"""
    try:
        raw: dict = MIDAS.structureTypeDB.get()
    except Exception as e:
        raise MidasApiError("Structure Mass 조회 실패", cause=str(e))

    styp: dict = raw.get("STYP", {})
    data: dict = next((v for v in styp.values() if isinstance(v, dict)), {})

    mass_map: dict[int, str] = {1: "Lumped Mass", 2: "Consistent Mass"}
    smass_map: dict[int, str] = {1: "X,Y,Z", 2: "X,Y", 3: "Z"}

    mass: int | None = data.get("MASS")
    smass: int | None = data.get("SMASS")

    return StructureMassResponse(
        MASS=mass,
        MASS_LABEL=mass_map.get(mass, str(mass) if mass is not None else "-"),
        SMASS=smass,
        SMASS_LABEL=smass_map.get(smass, str(smass) if smass is not None else "-"),
    )


@router.get("/load-to-mass")
def get_load_to_mass() -> LoadToMassResponse:
    """MIDAS GEN NX에서 Loads to Masses(LTOM) 정보를 가져와 반환"""
    try:
        raw: dict = MIDAS.loadToMassDB.get()
    except Exception as e:
        raise MidasApiError("Loads to Masses 조회 실패", cause=str(e))

    if "error" in raw:
        return LoadToMassResponse(
            DIR_X=False, DIR_Y=False, DIR_Z=False,
            bNODAL=False, bBEAM=False, bFLOOR=False, bPRES=False, vLC=[],
        )

    ltom: dict = raw.get("LTOM", {})
    data: dict = next((v for v in ltom.values() if isinstance(v, dict)), {})

    dir_str: str = data.get("DIR", "")
    return LoadToMassResponse(
        DIR_X="X" in dir_str.upper(),
        DIR_Y="Y" in dir_str.upper(),
        DIR_Z="Z" in dir_str.upper(),
        bNODAL=data.get("bNODAL", False),
        bBEAM=data.get("bBEAM", False),
        bFLOOR=data.get("bFLOOR", False),
        bPRES=data.get("bPRES", False),
        vLC=data.get("vLC", []),
    )


@router.get("/story-weight")
def get_story_weight() -> StoryWeightResponse:
    """MIDAS GEN NX 구조물 총 중량 (STORY_SHEAR_FORCE_COEFFICIENT의 Weight Sum)"""
    # SPLC에서 응답스펙트럼 하중 케이스 이름 조회
    try:
        splc_raw: dict = MIDAS.MidasAPI("GET", "/db/SPLC")
        splc: dict = splc_raw.get("SPLC", {})
        lc_names: list[str] = [f"{v['NAME']}(RS)" for v in splc.values() if isinstance(v, dict) and "NAME" in v]
    except Exception:
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
    try:
        raw: dict = MIDAS.MidasAPI("POST", "/post/TABLE", body)
    except Exception as e:
        raise MidasApiError("구조물 중량 조회 실패", cause=str(e))

    if "error" in raw:
        msg = raw["error"].get("message", "알 수 없는 오류") if isinstance(raw["error"], dict) else str(raw["error"])
        raise MidasApiError("구조물 중량 조회 실패", cause=msg)

    inner = next((v for v in raw.values() if isinstance(v, dict) and "HEAD" in v), {})
    head: list[str] = inner.get("HEAD", [])
    data: list[list] = inner.get("DATA", [])

    idx = {h: i for i, h in enumerate(head)}
    i_story = idx.get("Story", 1)
    i_spectrum = idx.get("Spectrum", 2)
    i_weight_x = idx.get("Weight Sum/X", 5)

    # STOR에서 GL=0 층 이름 조회
    try:
        stor_raw: dict = MIDAS.MidasAPI("GET", "/db/STOR")
        stor: dict = stor_raw.get("STOR", {})
        stor_list = [(v["STORY_NAME"], v["STORY_LEVEL"]) for v in stor.values() if isinstance(v, dict)]
        gl_entry = min(stor_list, key=lambda x: abs(x[1]))
        gl_story_name = gl_entry[0]
        gl_level = gl_entry[1]
    except Exception:
        gl_story_name = "1F"
        gl_level = 0.0

    # 해당 층의 Weight Sum 찾기
    first_lc = lc_names[0] if lc_names else ""
    gl_row = next(
        (r for r in data if r[i_spectrum] == first_lc and r[i_story] == gl_story_name),
        None,
    )

    if gl_row is None:
        raise MidasApiError("구조물 중량 조회 실패", cause=f"{gl_story_name} 층 데이터 없음")

    total_weight = float(gl_row[i_weight_x])

    return StoryWeightResponse(total_weight=total_weight, gl_story=gl_story_name, gl_level=gl_level)


@router.get("/story-shear")
def get_story_shear() -> list[StoryShearRow]:
    """MIDAS GEN NX 밑면 전단력 (STORY_SHEAR_FOR_RS)"""
    # SPLC에서 응답스펙트럼 하중 케이스 이름 조회
    try:
        splc_raw: dict = MIDAS.MidasAPI("GET", "/db/SPLC")
        splc: dict = splc_raw.get("SPLC", {})
        lc_names: list[str] = [f"{v['NAME']}(RS)" for v in splc.values() if isinstance(v, dict) and "NAME" in v]
    except Exception:
        lc_names = ["RX(RS)", "RY(RS)"]

    body = {
        "Argument": {
            "TABLE_NAME": "StoryShear",
            "TABLE_TYPE": "STORY_SHEAR_FOR_RS",
            "UNIT": {"FORCE": "kN", "DIST": "m"},
            "STYLES": {"FORMAT": "Fixed", "PLACE": 12},
            "LOAD_CASE_NAMES": lc_names,
        }
    }
    try:
        raw: dict = MIDAS.MidasAPI("POST", "/post/TABLE", body)
    except Exception as e:
        raise MidasApiError("밑면 전단력 조회 실패", cause=str(e))

    if "error" in raw:
        msg = raw["error"].get("message", "알 수 없는 오류") if isinstance(raw["error"], dict) else str(raw["error"])
        raise MidasApiError("밑면 전단력 조회 실패", cause=msg)

    inner = next((v for v in raw.values() if isinstance(v, dict) and "HEAD" in v), {})
    head: list[str] = inner.get("HEAD", [])
    data: list[list] = inner.get("DATA", [])

    # HEAD 인덱스 매핑
    idx = {h: i for i, h in enumerate(head)}
    i_story = idx.get("Story", 1)
    i_level = idx.get("Level", 2)
    i_spectrum = idx.get("Spectrum", 3)
    i_shear_x = idx.get("Shear Force/With Spring/X", 10)
    i_shear_y = idx.get("Shear Force/With Spring/Y", 11)
    i_story_force = idx.get("Story Force", 13)

    # Spectrum별로 분리 후 Story 기준으로 병합
    story_map: dict[str, dict] = {}
    for row in data:
        story_name: str = row[i_story]
        spectrum: str = row[i_spectrum]

        if story_name not in story_map:
            story_map[story_name] = {
                "story": story_name,
                "level": float(row[i_level]),
                "rx_shear_x": 0.0, "rx_shear_y": 0.0, "rx_story_force": 0.0,
                "ry_shear_x": 0.0, "ry_shear_y": 0.0, "ry_story_force": 0.0,
            }

        entry = story_map[story_name]
        shear_x = float(row[i_shear_x])
        shear_y = float(row[i_shear_y])
        story_force = float(row[i_story_force])

        if len(lc_names) >= 2 and spectrum == lc_names[0]:
            entry["rx_shear_x"] = shear_x
            entry["rx_shear_y"] = shear_y
            entry["rx_story_force"] = story_force
        elif len(lc_names) >= 2 and spectrum == lc_names[1]:
            entry["ry_shear_x"] = shear_x
            entry["ry_shear_y"] = shear_y
            entry["ry_story_force"] = story_force

    # 순서 유지 (원본 DATA 순서)
    seen: set[str] = set()
    results: list[StoryShearRow] = []
    for row in data:
        s = row[i_story]
        if s not in seen:
            seen.add(s)
            results.append(StoryShearRow(**story_map[s]))

    return results


def _head_data_to_dicts(table: dict) -> list[dict]:
    """HEAD+DATA 형식을 dict 리스트로 변환"""
    head: list[str] = table.get("HEAD", [])
    data: list[list] = table.get("DATA", [])
    return [{h: row[i] for i, h in enumerate(head)} for row in data]


@router.get("/eigenvalue")
def get_eigenvalue() -> list[EigenvalueRow]:
    """MIDAS GEN NX 고유치 해석 결과 (SUB_TABLE 1,2 병합)"""
    # 먼저 EIGV에서 모드 수를 가져옴
    try:
        eigv_raw: dict = MIDAS.MidasAPI("GET", "/db/EIGV")
        eigv_data: dict = eigv_raw.get("EIGV", {})
        first_val = next(iter(eigv_data.values()), {})
        num_modes: int = first_val.get("iFREQ", 21) if isinstance(first_val, dict) else 21
    except Exception:
        num_modes = 21

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
    try:
        raw: dict = MIDAS.MidasAPI("POST", "/post/TABLE", body)
    except Exception as e:
        raise MidasApiError("고유치 해석 결과 조회 실패", cause=str(e))

    # MIDAS API 에러 응답 처리
    if "error" in raw:
        msg = raw["error"].get("message", "알 수 없는 오류") if isinstance(raw["error"], dict) else str(raw["error"])
        raise MidasApiError("고유치 해석 결과 조회 실패", cause=msg)

    # SUB_TABLES 추출 (최상위 키 내부 탐색)
    inner = next(
        (v for v in raw.values()
         if isinstance(v, dict) and "SUB_TABLES" in v),
        raw,
    )
    sub_tables: list = inner.get("SUB_TABLES", [])
    if len(sub_tables) < 2:
        raise MidasApiError("고유치 해석 SUB_TABLE이 부족합니다", cause=f"SUB_TABLES 개수: {len(sub_tables)}")

    # SUB_TABLE 1: 고유치 정보 (Mode, Frequency, Period 등)
    st1_entries = sub_tables[0]
    st1_table = next(iter(st1_entries.values())) if isinstance(st1_entries, dict) else st1_entries
    st1_rows = _head_data_to_dicts(st1_table)

    # SUB_TABLE 2: 질량 참여율 (Mass, Sum)
    st2_entries = sub_tables[1]
    st2_table = next(iter(st2_entries.values())) if isinstance(st2_entries, dict) else st2_entries
    st2_rows = _head_data_to_dicts(st2_table)

    # Mode 번호로 병합
    st2_by_mode: dict[int, dict] = {}
    for r in st2_rows:
        mode_val = r.get("ModeNo")
        if mode_val is not None:
            st2_by_mode[int(float(str(mode_val)))] = r

    def _f(d: dict, *keys: str) -> float:
        for k in keys:
            if k in d:
                try:
                    return float(d[k])
                except (ValueError, TypeError):
                    pass
        return 0.0

    results: list[EigenvalueRow] = []
    for r1 in st1_rows:
        mode_val = r1.get("ModeNo")
        if mode_val is None:
            continue
        mode = int(float(str(mode_val)))
        r2 = st2_by_mode.get(mode, {})

        # SUB_TABLE[0]: Frequency(cycle/sec), Period(sec)
        # SUB_TABLE[1]: TRAN-X/Y/Z MASS/SUM(%), ROTN-X/Y/Z MASS/SUM(%)
        # 사용자 요청 순서: X, Y, ROTN-Z, Z, ROTN-X, ROTN-Y
        results.append(EigenvalueRow(
            mode=mode,
            frequency=_f(r1, "Frequency(cycle/sec)", "Frequency(Cycle/Sec)"),
            period=_f(r1, "Period(sec)", "Period(Sec)"),
            mass_x=_f(r2, "TRAN-XMASS(%)", "TRAN-XMASS"),
            mass_y=_f(r2, "TRAN-YMASS(%)", "TRAN-YMASS"),
            mass_rotn_z=_f(r2, "ROTN-ZMASS(%)", "ROTN-ZMASS"),
            mass_z=_f(r2, "TRAN-ZMASS(%)", "TRAN-ZMASS"),
            mass_rotn_x=_f(r2, "ROTN-XMASS(%)", "ROTN-XMASS"),
            mass_rotn_y=_f(r2, "ROTN-YMASS(%)", "ROTN-YMASS"),
            sum_x=_f(r2, "TRAN-XSUM(%)", "TRAN-XSUM"),
            sum_y=_f(r2, "TRAN-YSUM(%)", "TRAN-YSUM"),
            sum_rotn_z=_f(r2, "ROTN-ZSUM(%)", "ROTN-ZSUM"),
            sum_z=_f(r2, "TRAN-ZSUM(%)", "TRAN-ZSUM"),
            sum_rotn_x=_f(r2, "ROTN-XSUM(%)", "ROTN-XSUM"),
            sum_rotn_y=_f(r2, "ROTN-YSUM(%)", "ROTN-YSUM"),
        ))

    return results
