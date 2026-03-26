from ._midas_api import MidasAPI


class projectDB:
    """프로젝트 정보 (/db/PJCF)"""
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/PJCF")
        cls._data = result
        return result

    @classmethod
    def sync(cls) -> dict:
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        pjcf = cls._data.get("PJCF", {})
        if not pjcf:
            raise RuntimeError("PJCF 데이터가 없습니다. get()으로 먼저 데이터를 가져오세요.")
        body = {"Assign": pjcf}
        return MidasAPI("PUT", "/db/PJCF", body)
