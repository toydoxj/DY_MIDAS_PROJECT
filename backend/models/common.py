from pydantic import BaseModel


class StatusResponse(BaseModel):
    status: str


class SyncResponse(BaseModel):
    status: str
    count: int
