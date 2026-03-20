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
        pjcf = cls._data.get("PJCF", {})
        body = {"Assign": pjcf}
        return MidasAPI("PUT", "/db/PJCF", body)
