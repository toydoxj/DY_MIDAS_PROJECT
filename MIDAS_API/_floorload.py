from ._midas_api import MidasAPI


class floorLoadDB:
    """Floor Load Type (/db/FBLD)"""
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/FBLD")
        cls._data = result
        return result

    @classmethod
    def sync(cls) -> dict:
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        fbld = cls._data.get("FBLD", {})
        if not fbld:
            raise RuntimeError("FBLD 데이터가 없습니다.")
        body = {"Assign": fbld}
        return MidasAPI("PUT", "/db/FBLD", body)
