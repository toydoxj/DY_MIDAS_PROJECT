from ._midas_api import MidasAPI


class loadCaseDB:
    """Static Load Case (/db/STLD)"""
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/STLD")
        cls._data = result
        return result

    @classmethod
    def sync(cls) -> dict:
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        stld = cls._data.get("STLD", {})
        if not stld:
            raise RuntimeError("STLD 데이터가 없습니다. get()으로 먼저 데이터를 가져오세요.")
        body = {"Assign": stld}
        return MidasAPI("PUT", "/db/STLD", body)


class selfWeightDB:
    """Self-Weight (/db/BODF)"""
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/BODF")
        cls._data = result
        return result


class loadToMassDB:
    """Loads to Masses (/db/LTOM)"""
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/LTOM")
        cls._data = result
        return result
