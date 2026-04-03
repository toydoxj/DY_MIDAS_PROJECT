from __future__ import annotations

from typing import Any

from ._midas_api import MidasAPI


class sectionDB:
    """단면 정보 (/db/SECT)"""
    _data: dict = {}

    @classmethod
    def is_loaded(cls) -> bool:
        return bool(cls._data)

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/SECT")
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
        sect = cls._data.get("SECT", {})
        if not sect:
            raise RuntimeError("SECT 데이터가 없습니다.")
        body = {"Assign": sect}
        return MidasAPI("PUT", "/db/SECT", body)

    @classmethod
    def info(cls) -> dict[str, dict[str, Any]]:
        """단면 ID별 이름/형상/파라미터를 정리하여 반환한다.

        Returns
        -------
        { sect_id: {"name": str, "shape": str, "params": list}, ... }
        """
        if not cls._data:
            cls.get()
        sect = cls._data.get("SECT", {})
        result: dict[str, dict[str, Any]] = {}
        for sec_id, v in sect.items():
            sb = v.get("SECT_BEFORE", {}) if isinstance(v.get("SECT_BEFORE"), dict) else {}
            shape_code = sb.get("SHAPE", "")
            sect_i = sb.get("SECT_I", {}) if isinstance(sb.get("SECT_I"), dict) else {}
            vsize = sect_i.get("vSIZE", [])

            # 단면 크기 추출 (단위: m)
            size_info: dict[str, float] = {}
            if shape_code == "SB" and len(vsize) >= 2:
                size_info = {"B": vsize[1], "H": vsize[0]}
            elif shape_code == "SR" and len(vsize) >= 1:
                size_info = {"D": vsize[0]}

            result[sec_id] = {
                "name": v.get("SECT_NAME", ""),
                "shape": v.get("SECTTYPE", ""),
                "shape_code": shape_code,
                "size": size_info,
            }
        return result
