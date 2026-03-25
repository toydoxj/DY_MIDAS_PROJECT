from ._midas_api import MidasAPI


class projectDB:
    # 클래스 변수 (싱글톤 패턴 - _midas_api.py와 동일)
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        """MIDAS GEN NX API에서 프로젝트 정보를 가져와 클래스 변수에 저장"""
        result = MidasAPI("GET", "/db/PJCF")
        cls._data = result
        return result

    @classmethod
    def sync(cls) -> dict:
        """현재 클래스 변수를 MIDAS GEN NX API로 전송"""
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        pjcf = cls._data.get("PJCF", {})
        if not pjcf:
            raise RuntimeError("PJCF 데이터가 없습니다. get()으로 먼저 데이터를 가져오세요.")
        body = {"Assign": pjcf}
        return MidasAPI("PUT", "/db/PJCF", body)


class structureTypeDB:
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        """MIDAS GEN NX API에서 Structure Type(STYP) 정보를 가져와 클래스 변수에 저장"""
        result = MidasAPI("GET", "/db/STYP")
        cls._data = result
        return result
