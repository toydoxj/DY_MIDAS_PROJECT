from __future__ import annotations
from contextvars import ContextVar
from typing import Optional
import requests
import time

# 현재 컨텍스트의 MidasClient를 저장하는 ContextVar
_current_client: ContextVar[Optional["MidasClient"]] = ContextVar(
    "_current_client", default=None
)


class MidasClient:
    """인스턴스 기반 MIDAS API 클라이언트.

    contextvars.ContextVar를 사용하므로 asyncio / 멀티스레드 환경에서
    각 컨텍스트(요청)마다 독립된 설정을 가질 수 있습니다.

    기존 전역 방식(MIDAS_API_BASEURL, MIDAS_API_KEY + MidasAPI())은
    그대로 동작합니다.

    사용 예시
    ---------
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

        if method == "POST":
            response = requests.post(url, headers=headers, json=body)
        elif method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=body)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Invalid method: {method}")

        elapsed = time.perf_counter() - start_time
        print(f"Time taken: {elapsed:.2f} seconds")

        return response.json()

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
