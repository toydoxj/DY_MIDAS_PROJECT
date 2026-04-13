# midas-gen 공식 라이브러리의 설정 클래스를 직접 사용 (alias)
# MAPI_BASEURL(url), MAPI_KEY(key) → 기존 MIDAS_API_BASEURL(url), MIDAS_API_KEY(key) 호환
from midas_gen import MAPI_BASEURL as MIDAS_API_BASEURL
from midas_gen import MAPI_KEY as MIDAS_API_KEY


def MidasAPI(method: str, command: str, body: dict | None = None) -> dict:
    """안전한 MidasAPI 호출 (midas-gen의 sys.exit() 방지).

    midas-gen의 MidasAPI()는 401/404 시 sys.exit(0)을 호출하므로,
    FastAPI 서버에서는 MidasClient.request()를 통해 안전하게 호출한다.
    """
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
