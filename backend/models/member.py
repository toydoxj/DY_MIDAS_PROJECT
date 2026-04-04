from typing import Optional

from pydantic import BaseModel


class SectionInfo(BaseModel):
    id: int
    name: str
    type: str
    element_count: int
    element_keys: list[int]


class SectionDetailResponse(BaseModel):
    id: int
    name: str
    type: str
    element_keys: list[int]


class BeamForceMaxRequest(BaseModel):
    element_keys: list[int] = []
    section_names: list[str] = []  # SectName으로 필터링 (캐시 모드)
    group_by: str = "section"
    force_refresh: bool = False


class BeamForceMaxRow(BaseModel):
    SectName: str = ""
    B: Optional[float] = None
    H: Optional[float] = None
    D: Optional[float] = None
    My_neg_I_LC: str = ""
    My_neg_I: float = 0
    My_pos_I_LC: str = ""
    My_pos_I: float = 0
    Fz_I_LC: str = ""
    Fz_I: float = 0
    My_neg_C_LC: str = ""
    My_neg_C: float = 0
    My_pos_C_LC: str = ""
    My_pos_C: float = 0
    Fz_C_LC: str = ""
    Fz_C: float = 0
    My_neg_J_LC: str = ""
    My_neg_J: float = 0
    My_pos_J_LC: str = ""
    My_pos_J: float = 0
    Fz_J_LC: str = ""
    Fz_J: float = 0


# ── RC보 설계 검토 요청/응답 모델 ──

class RebarInput(BaseModel):
    position: str  # "I", "C", "J"
    top_dia: int = 25
    top_count: int = 3
    bot_dia: int = 25
    bot_count: int = 3
    stirrup_dia: int = 10
    stirrup_legs: int = 2
    stirrup_spacing: float = 200  # mm
    cover: float = 40.0  # mm


class SectionRebarInput(BaseModel):
    section_name: str
    B: float  # mm
    H: float  # mm
    fck: float = 27.0
    fy: float = 400.0
    fyt: float = 400.0
    rebars: list[RebarInput]  # I, C, J


class BeamDesignCheckRequest(BaseModel):
    sections: list[SectionRebarInput]
    forces: list[BeamForceMaxRow]


class SaveRebarsRequest(BaseModel):
    version: int = 1
    savedAt: Optional[str] = None
    sections: list[SectionRebarInput] = []


class PositionCheckResult(BaseModel):
    section_name: str
    position: str
    # 휨 (상부 = 음의 모멘트)
    neg_Mu_d: float = 0
    neg_phi_Mn: float = 0
    neg_flexure_dcr: float = 0
    neg_flexure_ok: bool = False
    # 휨 (하부 = 양의 모멘트)
    pos_Mu_d: float = 0
    pos_phi_Mn: float = 0
    pos_flexure_dcr: float = 0
    pos_flexure_ok: bool = False
    # 전단
    Vu_d: float = 0
    phi_Vn: float = 0
    shear_dcr: float = 0
    shear_ok: bool = False
    # 철근비
    rho: float = 0
    rho_min: float = 0
    rho_max: float = 0
    rho_min_ok: bool = False
    rho_max_ok: bool = False
    # 스터럽
    stirrup_spacing: float = 0
    stirrup_max_spacing: float = 0
    stirrup_ok: bool = False
    # 종합
    all_ok: bool = False


class BeamForceMemberRow(BaseModel):
    Memb: int
    My_neg_I_LC: str = ""
    My_neg_I: float = 0
    My_pos_I_LC: str = ""
    My_pos_I: float = 0
    Fz_I_LC: str = ""
    Fz_I: float = 0
    My_neg_C_LC: str = ""
    My_neg_C: float = 0
    My_pos_C_LC: str = ""
    My_pos_C: float = 0
    Fz_C_LC: str = ""
    Fz_C: float = 0
    My_neg_J_LC: str = ""
    My_neg_J: float = 0
    My_pos_J_LC: str = ""
    My_pos_J: float = 0
    Fz_J_LC: str = ""
    Fz_J: float = 0
