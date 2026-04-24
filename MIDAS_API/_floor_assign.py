from __future__ import annotations

from ._midas_api import MidasAPI


class floorLoadAssignDB:
    """Assign Floor Loads (/db/FBLA).

    FBLD 로 정의된 슬래브 하중 유형을 실제 노드 다각형에 할당한 데이터.
    floorLoadDB(/db/FBLD) 가 "타입 정의"라면 이 DB 는 "영역 할당".
    """
    _data: dict = {}

    @classmethod
    def is_loaded(cls) -> bool:
        return bool(cls._data)

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/FBLA")
        cls._data = result
        return result

    @classmethod
    def ensure_loaded(cls) -> dict:
        if not cls._data:
            cls.get()
        return cls._data

    @classmethod
    def sync(cls) -> dict:
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        fbla = cls._data.get("FBLA", {})
        if not fbla:
            raise RuntimeError("FBLA 데이터가 없습니다.")
        return MidasAPI("PUT", "/db/FBLA", {"Assign": fbla})
