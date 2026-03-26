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
