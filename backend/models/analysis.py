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


class LoadToMassResponse(BaseModel):
    DIR_X: bool
    DIR_Y: bool
    DIR_Z: bool
    bNODAL: bool
    bBEAM: bool
    bFLOOR: bool
    bPRES: bool
    vLC: list[int]
