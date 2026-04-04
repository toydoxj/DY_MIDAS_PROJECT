class MIDAS_API_BASEURL:
    baseURL: str = ""

    def __init__(self, baseURL: str):
        MIDAS_API_BASEURL.baseURL = baseURL

    @classmethod
    def get_url(cls) -> str:
        return cls.baseURL


class MIDAS_API_KEY:
    api_Key: str = ""

    def __init__(self, api_Key: str):
        MIDAS_API_KEY.api_Key = api_Key

    @classmethod
    def get_key(cls) -> str:
        return cls.api_Key


def MidasAPI(method: str, command: str, body: dict | None = None) -> dict:
    if body is None:
        body = {}

    from ._client import MidasClient

    # 1순위: ContextVar에 MidasClient가 설정된 경우
    ctx_client = MidasClient.get_current()
    if ctx_client is not None:
        return ctx_client.request(method, command, body)

    # 2순위: 전역 설정 → 임시 클라이언트 생성하여 위임
    client = MidasClient(
        base_url=MIDAS_API_BASEURL.get_url(),
        api_key=MIDAS_API_KEY.get_key(),
    )
    return client.request(method, command, body)
