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
