from pydantic import BaseModel


class LoadCaseItem(BaseModel):
    id: str
    NAME: str
    TYPE: str
    DESC: str


class LoadCaseSyncItem(BaseModel):
    id: str | int
    NAME: str
    TYPE: str
    DESC: str


class SPLCItem(BaseModel):
    id: str
    NAME: str
    DIR: str
    ANGLE: float
    aFUNCNAME: list[str]
    COMTYPE: str
    bADDSIGN: bool
    bACCECC: bool


class SPFCFuncPoint(BaseModel):
    PERIOD: float
    VALUE: float


class SPFCItem(BaseModel):
    id: str
    NAME: str
    SPEC_CODE: str
    ZONEFACTOR: float
    SC: int
    Sds: float
    Sd1: float
    Fa: float
    Fv: float
    IE: float
    R: float
    aFUNC: list[SPFCFuncPoint]
