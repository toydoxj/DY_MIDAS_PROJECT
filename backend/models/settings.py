from pydantic import BaseModel


class SettingsResponse(BaseModel):
    base_url: str
    api_key_masked: str


class SettingsUpdateRequest(BaseModel):
    base_url: str | None = None
    api_key: str | None = None


class ConnectionTestResponse(BaseModel):
    connected: bool
    message: str
