from __future__ import annotations
from contextvars import ContextVar
from typing import Optional
import logging
import requests
import time

logger = logging.getLogger("midas_api")

# 현재 컨텍스트의 MidasClient를 저장하는 ContextVar
_current_client: ContextVar[Optional["MidasClient"]] = ContextVar(
    "_current_client", default=None
)


class MidasAuthExpiredError(RuntimeError):
    """MIDAS GEN 세션이 활성 상태가 아닐 때 발생.

    공식 midas-gen 라이브러리(_mapi.py:244-255) 기준 응답 의미:
        401 → MAPI-Key가 무효함 (오타/잘못된 값)
        404 → "GEN NX model is not connected" — Apps > Connect가 끊긴 상태,
              또는 Base URL이 사용자의 MIDAS 지역 서버와 일치하지 않음
              (예: 한국 GEN 키를 글로벌 URL로 호출)

    어느 쪽이든 사용자가 [설정] 페이지에서 조치해야 하므로 같은 예외로 묶는다.
    """

    def __init__(self, message: str, *, status_code: int) -> None:
        self.status_code = status_code
        super().__init__(message)


class MidasClient:
    """인스턴스 기반 MIDAS API 클라이언트 (ContextVar 격리).

    .. note::
       **현재 어떤 라우터/엔진 모듈도 이 클래스를 사용하지 않는다.**
       사내 Electron 단일 사용자 모드에서는 backend/routers/settings.py 가
       관리하는 전역 setter (MIDAS_API_BASEURL, MIDAS_API_KEY)만 사용된다.
       본 클래스는 향후 멀티테넌트 확장(사용자별 격리)을 위해 보존됨.
       삭제 시 _client.py 의 MidasAuthExpiredError 와 응답 본문 파싱 로직도
       함께 잃게 되므로 삭제 금지.

    asyncio / 멀티스레드 환경에서 각 컨텍스트(요청)마다 독립된 설정을 가질 수 있다.

    사용 예시 (미래 확장용)
    -----------------------
    # 일반 사용
    client = MidasClient(base_url="http://...", api_key="...")
    result = client.request("GET", "/db/STOR")

    # context manager (with 블록 안에서 MidasAPI()도 이 인스턴스 사용)
    with MidasClient(base_url="http://...", api_key="...") as client:
        result = client.request("GET", "/db/STOR")
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url
        self.api_key = api_key

    # ------------------------------------------------------------------ #
    # Context manager — with 블록 내에서 MidasAPI() 전역 함수도 이 인스턴스 사용
    # ------------------------------------------------------------------ #

    def __enter__(self) -> "MidasClient":
        self._token = _current_client.set(self)
        return self

    def __exit__(self, *args: object) -> None:
        _current_client.reset(self._token)

    # ------------------------------------------------------------------ #
    # HTTP 요청
    # ------------------------------------------------------------------ #

    def request(self, method: str, command: str, body: Optional[dict] = None) -> dict:
        """MIDAS API에 HTTP 요청을 보내고 JSON dict를 반환합니다.

        Parameters
        ----------
        method : str
            "GET" | "POST" | "PUT" | "DELETE"
        command : str
            API 경로 (예: "/db/STOR")
        body : dict, optional
            POST/PUT 요청 본문
        """
        if body is None:
            body = {}

        url = self.base_url + command
        headers = {
            "Content-Type": "application/json",
            "MAPI-Key": self.api_key,
        }

        start_time = time.perf_counter()

        try:
            response = requests.request(method, url, headers=headers, json=body, timeout=60)
            response.raise_for_status()
        except requests.ConnectionError:
            raise ConnectionError(f"MIDAS 서버에 연결할 수 없습니다: {url}")
        except requests.Timeout:
            raise TimeoutError(f"MIDAS API 요청 시간 초과 (60초): {method} {command}")
        except requests.HTTPError as e:
            # 응답 본문(있으면)을 파싱해 정확한 원인을 진단
            body_msg = ""
            try:
                body_json = response.json()
                if isinstance(body_json, dict):
                    err = body_json.get("error")
                    if isinstance(err, dict):
                        body_msg = str(err.get("message", "")).strip()
                    elif isinstance(err, str):
                        body_msg = err.strip()
            except ValueError:
                body_msg = response.text[:200].strip()

            if response.status_code == 401:
                raise MidasAuthExpiredError(
                    "MAPI-Key가 무효합니다. MIDAS GEN의 [API Settings] 패널에서 "
                    "현재 MAPI-Key를 복사해 [설정] 페이지에서 다시 저장하세요. "
                    f"(서버 응답: {body_msg or '인증 실패'})",
                    status_code=401,
                )
            if response.status_code == 404:
                # 'client does not exist' = 키는 인식되지만 GEN 세션이 서버에 없음 (좀비 연결)
                if "client does not exist" in body_msg.lower():
                    raise MidasAuthExpiredError(
                        "MIDAS GEN 세션이 서버에서 사라졌습니다 (좀비 연결). "
                        "MIDAS GEN 화면에는 [Connected]로 보여도 실제로는 끊어져 있습니다. "
                        "다음을 시도하세요:\n"
                        "  1) MIDAS GEN의 [API Settings] 패널에서 [Disconnect] 후 [Connect] 다시 클릭\n"
                        "  2) 새로 발급된 MAPI-Key를 [Copy]해서 [설정] 페이지에 다시 저장\n"
                        "  3) 그래도 안 되면 MIDAS GEN을 완전히 종료한 뒤 재실행하고 Connect\n"
                        f"(서버 응답: {body_msg})",
                        status_code=404,
                    )
                raise MidasAuthExpiredError(
                    "MIDAS GEN 세션을 찾을 수 없습니다. 다음을 확인하세요:\n"
                    "  1) MIDAS GEN의 [API Settings]에서 Status가 Connected인지\n"
                    "  2) Base URL의 지역 서버가 GEN과 일치하는지 ([지역 자동 감지] 사용)\n"
                    f"(서버 응답: {body_msg or '404 Not Found'})",
                    status_code=404,
                )
            raise RuntimeError(
                f"MIDAS API 응답 오류 ({response.status_code}): {body_msg or e}"
            )

        elapsed = time.perf_counter() - start_time
        logger.debug("API %s %s — %.2f초", method, command, elapsed)

        try:
            return response.json()
        except ValueError:
            raise RuntimeError(f"MIDAS API JSON 파싱 실패: {response.text[:200]}")

    # ------------------------------------------------------------------ #
    # ContextVar 헬퍼 (클래스 메서드)
    # ------------------------------------------------------------------ #

    @classmethod
    def get_current(cls) -> Optional["MidasClient"]:
        """현재 컨텍스트에 설정된 MidasClient를 반환합니다."""
        return _current_client.get()

    @classmethod
    def set_current(cls, client: "MidasClient") -> None:
        """현재 컨텍스트에 MidasClient를 설정합니다."""
        _current_client.set(client)
