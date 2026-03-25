from ._midas_api import MidasAPI


class loadCaseDB:
    # 클래스 변수 (싱글톤 패턴 - _projectDB.py와 동일)
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        """MIDAS GEN NX API에서 Static Load Case 정보를 가져와 클래스 변수에 저장"""
        result = MidasAPI("GET", "/db/STLD")
        cls._data = result
        return result

    @classmethod
    def sync(cls) -> dict:
        """현재 클래스 변수를 MIDAS GEN NX API로 전송"""
        if not cls._data:
            raise RuntimeError("동기화 전에 get()을 먼저 호출하세요.")
        stld = cls._data.get("STLD", {})
        if not stld:
            raise RuntimeError("STLD 데이터가 없습니다. get()으로 먼저 데이터를 가져오세요.")
        body = {"Assign": stld}
        return MidasAPI("PUT", "/db/STLD", body)


class selfWeightDB:
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        """MIDAS GEN NX API에서 Self-Weight(BODF) 정보를 가져와 클래스 변수에 저장"""
        result = MidasAPI("GET", "/db/BODF")
        cls._data = result
        return result


class loadToMassDB:
    _data: dict = {}

    @classmethod
    def get(cls) -> dict:
        """MIDAS GEN NX API에서 Loads to Masses(LTOM) 정보를 가져와 클래스 변수에 저장"""
        result = MidasAPI("GET", "/db/LTOM")
        cls._data = result
        return result
