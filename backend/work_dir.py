"""작업 폴더 관리 모듈

작업 폴더 경로를 저장/로드하고, 데이터 저장 경로를 제공한다.
설정 파일은 AppData(Electron) 또는 프로젝트 루트(개발)에 저장.
"""

import json
import os
import sys

# 설정 파일 위치 결정
if getattr(sys, "frozen", False):
    _APP_DATA = os.path.join(os.environ.get("APPDATA", ""), "midas-gen-nx-dashboard")
else:
    _APP_DATA = os.path.join(os.path.dirname(__file__), "..")

_CONFIG_FILE = os.path.join(_APP_DATA, "work_dir.json")

_DEFAULT_WORK_DIR = os.path.join(os.path.expanduser("~"), "Documents", "MIDAS_Dashboard")

# 번들 내 데이터 폴더 (템플릿, 기준 데이터 등 읽기 전용)
if getattr(sys, "frozen", False):
    BUNDLE_DATA_DIR: str = os.path.join(sys._MEIPASS, "data")
else:
    BUNDLE_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


class WorkDirError(Exception):
    """설정된 작업 폴더를 사용할 수 없을 때 발생"""
    def __init__(self, configured_path: str):
        self.configured_path = configured_path
        super().__init__(f"작업 폴더를 찾을 수 없습니다: {configured_path}")


def _read_config() -> str | None:
    """설정 파일에서 저장된 경로를 읽는다. 설정 없으면 None."""
    if not os.path.isfile(_CONFIG_FILE):
        return None
    try:
        with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("work_dir") or None
    except Exception:
        return None


def get_work_dir() -> str:
    """작업 폴더 경로를 반환.

    - 설정이 없으면 기본 폴더를 생성하여 반환 (최초 실행)
    - 설정이 있지만 폴더가 없으면 WorkDirError 발생 (데이터 분산 방지)
    """
    configured = _read_config()

    if configured is None:
        # 최초 실행: 기본 폴더 생성 및 설정 저장
        os.makedirs(_DEFAULT_WORK_DIR, exist_ok=True)
        set_work_dir(_DEFAULT_WORK_DIR)
        return _DEFAULT_WORK_DIR

    if not os.path.isdir(configured):
        raise WorkDirError(configured)

    return configured


def get_work_dir_safe() -> tuple[str, str | None]:
    """get_work_dir의 안전한 버전. (경로, 에러메시지) 반환."""
    try:
        return get_work_dir(), None
    except WorkDirError as e:
        return "", f"작업 폴더를 찾을 수 없습니다: {e.configured_path}"


def set_work_dir(path: str) -> str:
    """작업 폴더 경로를 저장. 폴더가 없으면 생성."""
    real_path = os.path.realpath(path)
    os.makedirs(real_path, exist_ok=True)
    os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)
    with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"work_dir": real_path}, f, ensure_ascii=False, indent=2)
    return real_path


def get_save_path(filename: str) -> str:
    """작업 폴더 내 파일 경로를 반환."""
    wd = get_work_dir()
    os.makedirs(wd, exist_ok=True)
    return os.path.join(wd, filename)
