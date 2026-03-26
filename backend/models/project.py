from pydantic import BaseModel


class ProjectInfo(BaseModel):
    PROJECT: str
    CLIENT: str
    ADDRESS: str
    COMMENT: str


class ProjectUpdateRequest(BaseModel):
    PROJECT: str | None = None
    CLIENT: str | None = None
    ADDRESS: str | None = None
    COMMENT: str | None = None
