from __future__ import annotations

from typing import Any

from ._midas_api import MidasAPI


class elementDB:
    """요소 정보 (/db/ELEM)"""
    _data: dict = {}

    @classmethod
    def is_loaded(cls) -> bool:
        return bool(cls._data)

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/ELEM")
        cls._data = result
        return result

    @classmethod
    def ensure_loaded(cls) -> dict:
        """캐시된 데이터가 없을 때만 조회한다."""
        if not cls._data:
            cls.get()
        return cls._data

    @classmethod
    def sync(cls) -> dict:
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        elem = cls._data.get("ELEM", {})
        if not elem:
            raise RuntimeError("ELEM 데이터가 없습니다.")
        body = {"Assign": elem}
        return MidasAPI("PUT", "/db/ELEM", body)

    @classmethod
    def beam_section_map(cls) -> dict[int, int]:
        """보/트러스 요소 → 단면 ID 매핑을 반환한다.

        Returns
        -------
        { elem_id: sect_id, ... }
        """
        if not cls._data:
            cls.get()
        elem = cls._data.get("ELEM", {})
        mapping: dict[int, int] = {}
        for eid, v in elem.items():
            etype = v.get("TYPE", "")
            if etype in ("BEAM", "TRUSS"):
                sect_id = v.get("SECT", 0)
                mapping[int(eid)] = int(sect_id)
        return mapping
