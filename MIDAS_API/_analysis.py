from ._midas_api import MidasAPI


class structureTypeDB:
    """Structure Type (/db/STYP)"""
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        result = MidasAPI("GET", "/db/STYP")
        cls._data = result
        return result
