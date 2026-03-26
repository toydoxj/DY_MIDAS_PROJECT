"""FastAPI Dependency Injection — MidasClient 통합.

사용 예시
---------
from fastapi import APIRouter, Depends
from dependencies import get_midas_client
from MIDAS_API import MidasClient

router = APIRouter()

@router.get("/example")
def example(client: MidasClient = Depends(get_midas_client)):
    return client.request("GET", "/db/STOR")
"""

import os
from functools import lru_cache

from MIDAS_API import MidasClient


@lru_cache(maxsize=1)
def get_midas_client() -> MidasClient:
    """환경변수에서 URL/키를 읽어 MidasClient 싱글톤 인스턴스를 반환합니다.

    FastAPI의 Depends()와 함께 사용하세요.
    서버 재시작 없이 환경변수를 바꾸려면 get_midas_client.cache_clear()를 호출하세요.
    """
    base_url = os.environ.get("MIDAS_BASE_URL", "")
    api_key = os.environ.get("MIDAS_API_KEY", "")
    return MidasClient(base_url=base_url, api_key=api_key)
