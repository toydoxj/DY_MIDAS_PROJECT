from __future__ import annotations

from typing import Any


def dict_to_rows(data: dict[str, Any], id_col: str = "ID") -> list[dict[str, Any]]:
    """중첩 dict를 엑셀 친화적인 행 리스트로 평탄화한다.

    규칙:
    - 값이 dict인 항목만 행으로 변환한다.
    - 각 행에는 상위 key를 `id_col` 컬럼으로 추가한다.
    - 값이 dict가 아닌 항목은 `value` 컬럼으로 저장한다.
    """
    rows: list[dict[str, Any]] = []

    for key, value in data.items():
        if isinstance(value, dict):
            row = {id_col: key}
            row.update(value)
        else:
            row = {id_col: key, "value": value}
        rows.append(row)

    return rows


def to_dataframe(data: dict[str, Any], id_col: str = "ID"):
    """dict를 pandas.DataFrame으로 변환한다.

    pandas가 설치되어 있지 않으면 ImportError를 발생시킨다.
    """
    try:
        import pandas as pd
    except ImportError as exc:
        raise ImportError(
            "pandas가 설치되어 있지 않습니다. `pip install pandas` 후 다시 시도하세요."
        ) from exc

    rows = dict_to_rows(data, id_col=id_col)
    return pd.DataFrame(rows)
