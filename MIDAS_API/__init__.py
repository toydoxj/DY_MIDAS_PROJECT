from ._midas_api import MIDAS_API_BASEURL, MIDAS_API_KEY, MidasAPI
from ._to_excel import dict_to_rows, to_dataframe
# MidasClient: ContextVar 기반 인스턴스 클라이언트.
# 현재 사용 안 함, 미래 멀티테넌트 확장용으로 보존 (자세한 내용은 _client.py docstring 참조).
from ._client import MidasClient
from ._project import projectDB
from ._loads import loadCaseDB, selfWeightDB, loadToMassDB
from ._analysis import structureTypeDB
from ._floorload import floorLoadDB
from ._floor_assign import floorLoadAssignDB
from ._section import sectionDB
from ._element import elementDB
from ._node import nodeDB
from ._beam_force import beamForceDB

# midas-gen 공식 기능 re-export (선택적 사용)
from midas_gen import (
    MAPI_COUNTRY,
    Result,
    TableOptions,
    Section,
    Element,
    Node,
    Load,
    Material,
    Model,
)

__version__ = "0.0.2"
__author__ = "Jeong, Jihun"
__copyright__ = "Copyright 2026 Dongyang Consulting Engineering Co., Ltd."
__description__ = "MIDAS-API is a Python library for the MIDAS GEN NX API."


def clear_all_caches() -> list[str]:
    """모든 classmethod 기반 DB 래퍼의 `_data` 캐시를 초기화.

    MIDAS에서 **다른 모델 파일로 전환**한 뒤 stale 데이터를 피하려 할 때 사용.
    beamForceDB 의 2단 캐시(_df_cache)도 함께 비운다.

    반환: 클리어된 DB 클래스 이름 리스트.
    """
    cleared: list[str] = []
    for db in (
        projectDB, loadCaseDB, selfWeightDB, loadToMassDB, structureTypeDB,
        floorLoadDB, floorLoadAssignDB, sectionDB, elementDB, nodeDB,
    ):
        try:
            db._data = {}
            cleared.append(db.__name__)
        except Exception:
            pass
    # beamForceDB 는 자체 clear_cache 사용
    try:
        beamForceDB.clear_cache()
        cleared.append("beamForceDB")
    except Exception:
        pass
    return cleared

