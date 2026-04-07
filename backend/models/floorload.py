from typing import Any
from pydantic import BaseModel, Field


class KdsLiveLoadItem(BaseModel):
    category: str
    detail: str
    load: str


class FinishItem(BaseModel):
    material: str = ""
    density: str = ""
    thickness: str = ""
    load: str = ""


class FloorLoadEntry(BaseModel):
    id: int
    floor: str = ""
    roomName: str = ""
    desc: str = ""
    finishes: list[FinishItem] = Field(default_factory=list)
    slabType: str = "없음"
    slabThickness: str = ""
    slabLoad: str = ""
    usageCategory: str = ""
    usageDetail: str = ""
    liveLoad: str = ""


class FloorLoadSaveResponse(BaseModel):
    status: str
    count: int


class ImportedFloorLoadItem(BaseModel):
    id: int
    floor: str
    roomName: str
    desc: str
    finishes: list[dict[str, Any]]
    slabType: str
    slabThickness: str
    slabLoad: str
    usageCategory: str
    usageDetail: str
    liveLoad: str


class ImportMidasResponse(BaseModel):
    imported: list[ImportedFloorLoadItem]
    count: int


class SyncMidasResponse(BaseModel):
    status: str
    count: int
