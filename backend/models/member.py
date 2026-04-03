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
