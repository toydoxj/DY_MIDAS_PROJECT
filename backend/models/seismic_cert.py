from pydantic import BaseModel


class SeismicCertAutoData(BaseModel):
    """MIDAS API에서 자동 수집한 구조안전확인서 데이터"""
    # 프로젝트 기본
    project_name: str = ""
    address: str = ""
    importance: str = ""
    floor_area: float = 0.0
    actual_height: float = 0.0

    # 층 정보
    above_floors: int = 0
    below_floors: int = 0
    total_height: float = 0.0

    # SFRS
    struct_type_x: str = ""
    struct_type_y: str = ""
    sfrs_x: str = ""
    sfrs_y: str = ""

    # SPFC
    spec_code: str = ""
    zone_factor: float = 0.0
    sc: int = 0
    sc_label: str = ""
    ie: float = 0.0
    r_x: float = 0.0
    r_y: float = 0.0
    sds: float = 0.0
    sd1: float = 0.0

    # 해석 결과
    total_weight: float = 0.0
    vsx: float = 0.0
    vsy: float = 0.0
    csx: float = 0.0
    csy: float = 0.0
    tax: float = 0.0
    tay: float = 0.0

    # 자동 계산
    seismic_category: str = ""
    form_type: str = ""  # "5층이하" or "6층이상"
    allowable_drift: str = ""  # 중요도 기반 자동 설정
    design_code: str = "KDS(41-00-00:2022)"

    # 모드 해석 (상위 3개 모드)
    mode1_period: float = 0.0
    mode1_mass_ratio: float = 0.0
    mode2_period: float = 0.0
    mode2_mass_ratio: float = 0.0
    mode3_period: float = 0.0
    mode3_mass_ratio: float = 0.0


class SeismicCertManualData(BaseModel):
    """사용자 수동입력 데이터"""
    # 기본 정보
    usage: str = ""
    design_code: str = ""
    struct_plan: str = ""

    # 지반 및 기초
    ground_water_level: str = ""
    foundation_type: str = ""
    design_bearing: str = ""
    pile_capacity: str = ""

    # 내진설계
    analysis_method: str = "동적해석법"
    seismic_category_override: str = ""

    # 횡력저항시스템
    sfrs_x_detail: str = ""
    sfrs_y_detail: str = ""
    allowable_drift: str = "0.015hs"
    max_drift_x: str = ""
    max_drift_y: str = ""

    # 구조요소 검토
    has_piloti: str = "무"
    has_out_of_plane: str = "무"
    has_lateral_discontinuity: str = "무"
    has_vertical_discontinuity: str = "무"

    # 비구조요소
    arch_non_structural: str = ""
    mech_non_structural: str = ""

    # 특이사항
    special_notes: str = ""

    # 작성자/설계자
    author_name: str = ""
    designer_name: str = ""
    author_address: str = ""
    designer_address: str = ""
    author_phone: str = ""
    designer_phone: str = ""
    submit_date: str = ""

    # 6층이상 전용 - 풍하중
    basic_wind_speed: str = ""
    wind_exposure: str = ""
    gust_factor: str = ""
    wind_importance: str = ""
    max_story_disp_x: str = ""
    max_story_disp_y: str = ""
    max_story_drift_x: str = ""
    max_story_drift_y: str = ""

    # 6층이상 전용 - 모드 해석
    mode1_period: str = ""
    mode1_mass_ratio: str = ""
    mode2_period: str = ""
    mode2_mass_ratio: str = ""
    mode3_period: str = ""
    mode3_mass_ratio: str = ""


class SeismicCertRequest(BaseModel):
    """hwpx 생성 요청"""
    auto_data: SeismicCertAutoData
    manual_data: SeismicCertManualData
