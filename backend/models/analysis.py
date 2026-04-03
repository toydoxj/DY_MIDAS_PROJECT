from pydantic import BaseModel


class SelfWeightRow(BaseModel):
    id: str
    LCNAME: str
    GROUP_NAME: str
    FV: list[float]
    factor: float | None
    valid: bool


class StructureMassResponse(BaseModel):
    MASS: int | None
    MASS_LABEL: str
    SMASS: int | None
    SMASS_LABEL: str


class LoadToMassLC(BaseModel):
    LCNAME: str
    FACTOR: float


class LoadToMassResponse(BaseModel):
    DIR_X: bool
    DIR_Y: bool
    DIR_Z: bool
    bNODAL: bool
    bBEAM: bool
    bFLOOR: bool
    bPRES: bool
    vLC: list[LoadToMassLC]


class StoryWeightResponse(BaseModel):
    total_weight: float
    gl_story: str
    gl_level: float


class StoryShearRow(BaseModel):
    story: str
    level: float
    rx_shear_x: float
    rx_shear_y: float
    rx_story_force: float
    ry_shear_x: float
    ry_shear_y: float
    ry_story_force: float


class EigenvalueRow(BaseModel):
    mode: int
    frequency: float
    period: float
    mass_x: float
    mass_y: float
    mass_rotn_z: float
    mass_z: float
    mass_rotn_x: float
    mass_rotn_y: float
    sum_x: float
    sum_y: float
    sum_rotn_z: float
    sum_z: float
    sum_rotn_x: float
    sum_rotn_y: float
