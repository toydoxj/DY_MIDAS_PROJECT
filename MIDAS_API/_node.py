from __future__ import annotations

from ._midas_api import MidasAPI


class nodeDB:
    """노드 좌표 정보 (/db/NODE)"""
    _data: dict = {}

    @classmethod
    def is_loaded(cls) -> bool:
        return bool(cls._data)

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/NODE")
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
        node = cls._data.get("NODE", {})
        if not node:
            raise RuntimeError("NODE 데이터가 없습니다.")
        body = {"Assign": node}
        return MidasAPI("PUT", "/db/NODE", body)

    @classmethod
    def coord_map(cls) -> dict[int, tuple[float, float, float]]:
        """노드 ID → (X, Y, Z) 좌표 매핑을 반환한다.

        Returns
        -------
        { node_id: (X, Y, Z), ... }
        """
        if not cls._data:
            cls.get()
        node = cls._data.get("NODE", {})
        result: dict[int, tuple[float, float, float]] = {}
        for nid, v in node.items():
            if not isinstance(v, dict):
                continue
            result[int(nid)] = (
                float(v.get("X", 0.0)),
                float(v.get("Y", 0.0)),
                float(v.get("Z", 0.0)),
            )
        return result
