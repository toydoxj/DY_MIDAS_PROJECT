from __future__ import annotations

from typing import Any, Optional

from ._midas_api import MidasAPI
from ._section import sectionDB
from ._element import elementDB

try:
    import pandas as pd
    _HAS_PANDAS = True
except ImportError:
    _HAS_PANDAS = False


# 기본 COMPONENTS
_DEFAULT_COMPONENTS = ["Memb", "Part", "LComName", "Type", "Fz", "My(-)", "My(+)"]


class beamForceDB:
    """설계 부재력 추출 (POST /post/table — BEAMDESIGNFORCES)

    흐름:
      1. POST /post/table  → 설계 부재력 일괄 조회
      2. i단 / j단 필터링
      3. 단면정보 JOIN
      4. Excel 출력
    """
    _raw: dict = {}
    _rows: list[dict[str, Any]] = []
    _last_keys: Optional[list[int]] = None
    _loaded_all: bool = False  # 전체 부재 조회 완료 여부
    _df_cache: Any = None  # to_dataframe() 캐시

    # ------------------------------------------------------------------ #
    # STEP 1 · 설계 부재력 일괄 추출
    # ------------------------------------------------------------------ #

    @classmethod
    def get(
        cls,
        keys: Optional[list[int]] = None,
        parts: Optional[list[str]] = None,
        components: Optional[list[str]] = None,
        force_unit: str = "KN",
        dist_unit: str = "M",
        fmt: str = "Fixed",
        place: int = 1,
    ) -> dict:
        """설계 부재력을 일괄 조회한다.

        Parameters
        ----------
        keys : list[int], optional
            조회할 요소(부재) ID 목록. None이면 전체.
        parts : list[str], optional
            위치 목록. 기본값 ["PartI", "PartJ"].
        components : list[str], optional
            성분 목록. 기본값 ["Memb","Part","LComName","Type","Fz","Mx","My(-)","My(+)"].
        force_unit : str
            힘 단위. 기본값 "KN".
        dist_unit : str
            거리 단위. 기본값 "M".
        fmt : str
            출력 형식. "Fixed" 또는 "Scientific".
        place : int
            소수점 자릿수.
        """
        if parts is None:
            parts = ["PartI", "Part2/4", "PartJ"]
        if components is None:
            components = list(_DEFAULT_COMPONENTS)

        argument: dict[str, Any] = {
            "TABLE_TYPE": "BEAMDESIGNFORCES",
            "UNIT": {
                "FORCE": force_unit,
                "DIST": dist_unit,
            },
            "STYLES": {
                "FORMAT": fmt,
                "PLACE": place,
            },
            "PARTS": parts,
            "COMPONENTS": components,
        }

        if keys:
            argument["NODE_ELEMS"] = {"KEYS": keys}

        body = {"Argument": argument}

        result = MidasAPI("POST", "/post/table", body)
        cls._raw = result
        cls._rows = []
        cls._df_cache = None
        cls._last_keys = sorted(keys) if keys else None
        cls._loaded_all = (keys is None)
        return result

    @classmethod
    def ensure_loaded_all(cls, **kwargs) -> dict:
        """전체 부재력이 캐시에 없으면 한 번에 조회한다."""
        if not cls._loaded_all or not cls._raw:
            cls.get(keys=None, **kwargs)
        return cls._raw

    # ------------------------------------------------------------------ #
    # STEP 2 · 응답 파싱 → 행 리스트
    # ------------------------------------------------------------------ #

    @classmethod
    def parse(cls) -> list[dict[str, Any]]:
        """원시 응답을 행 리스트로 변환한다.

        Returns
        -------
        list[dict]
        """
        if not cls._raw:
            raise RuntimeError("parse() 전에 get()을 먼저 호출하세요.")

        # 응답 구조 탐색: 다양한 키 패턴 대응
        table_data = cls._raw.get("BEAMDESIGNFORCES", {})
        if not table_data:
            table_data = cls._raw.get("BeamDesignForces", {})
        if not table_data:
            # DATA 키 또는 첫 번째 dict/list 값 사용
            table_data = cls._raw.get("DATA", cls._raw.get("data", {}))
        if not table_data:
            for v in cls._raw.values():
                if isinstance(v, (dict, list)):
                    table_data = v
                    break

        # dict → 행 리스트, list → 그대로
        if isinstance(table_data, dict):
            # HEAD + DATA 패턴: 컬럼명 리스트 + 데이터 이중 리스트
            if "HEAD" in table_data and "DATA" in table_data:
                head = table_data["HEAD"]
                data = table_data["DATA"]
                rows: list[dict[str, Any]] = []
                for record in data:
                    row = {}
                    for i, col in enumerate(head):
                        row[col] = record[i] if i < len(record) else None
                    rows.append(row)
                cls._rows = rows
            else:
                rows = []
                for key, value in table_data.items():
                    if isinstance(value, dict):
                        row = {"Index": key}
                        row.update(value)
                        rows.append(row)
                cls._rows = rows
        elif isinstance(table_data, list):
            cls._rows = table_data
        else:
            cls._rows = []

        return cls._rows

    # ------------------------------------------------------------------ #
    # STEP 3 · i단/j단 피벗 (한 행에 I/J 컬럼)
    # ------------------------------------------------------------------ #

    @classmethod
    def pivot(
        cls,
        force_components: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        """parse() 결과를 Memb+LComName 기준으로 PartI/PartJ 컬럼을 피벗한다.

        Parameters
        ----------
        force_components : list[str], optional
            피벗 대상 성분. 기본값 ["Fz", "Mx", "My(-)", "My(+)"].

        Returns
        -------
        list[dict]
        """
        if not cls._rows:
            cls.parse()

        if force_components is None:
            force_components = ["Fz", "My(-)", "My(+)"]

        part_suffix_map = {
            "I": "_I",
            "J": "_J",
            "1/2": "_C",
            "2/4": "_C",
            "I/4": "_Q1",
            "3/4": "_Q3",
            # 레거시 호환 (PARTI, PARTJ 등)
            "PARTI": "_I",
            "PARTJ": "_J",
            "PART1/2": "_C",
            "PARTI/4": "_Q1",
            "PART3/4": "_Q3",
        }

        grouped: dict[tuple, dict[str, Any]] = {}
        for row in cls._rows:
            memb = row.get("Memb", row.get("Element", ""))
            lcom = row.get("LComName", row.get("Load", ""))
            rtype = row.get("Type", "")
            key = (memb, lcom, rtype)

            if key not in grouped:
                grouped[key] = {"Memb": memb, "LComName": lcom, "Type": rtype}

            part = str(row.get("Part", "")).upper().replace(" ", "")
            suffix = part_suffix_map.get(part)
            if suffix:
                for comp in force_components:
                    grouped[key][f"{comp}{suffix}"] = row.get(comp, 0)

        return list(grouped.values())

    # ------------------------------------------------------------------ #
    # STEP 4 · 단면정보 JOIN + DataFrame
    # ------------------------------------------------------------------ #

    @classmethod
    def to_dataframe(
        cls,
        force_components: Optional[list[str]] = None,
        with_section: bool = True,
    ):
        """피벗된 부재력에 단면정보를 조인하여 DataFrame으로 반환한다.

        Parameters
        ----------
        force_components : list[str], optional
            피벗 대상 성분. 기본값 ["Fz", "Mx", "My(-)", "My(+)"].
        with_section : bool
            True이면 sectionDB/elementDB에서 단면정보를 자동 조인.
        """
        if not _HAS_PANDAS:
            raise ImportError(
                "pandas가 설치되어 있지 않습니다. `pip install pandas` 후 다시 시도하세요."
            )

        # DataFrame 캐시 반환 (전체 조회 모드에서 반복 호출 최적화)
        if cls._df_cache is not None:
            return cls._df_cache.copy()

        pivoted = cls.pivot(force_components=force_components)
        df = pd.DataFrame(pivoted)

        if df.empty:
            return df

        if not with_section:
            return df

        # 요소-단면 매핑
        elem_map = elementDB.beam_section_map()
        df["SectionID"] = df["Memb"].apply(
            lambda e: elem_map.get(int(e), None) if e is not None else None
        )

        # 단면 상세
        sect_info = sectionDB.info()
        df["SectName"] = df["SectionID"].apply(
            lambda s: sect_info.get(str(int(s)), {}).get("name", "") if pd.notna(s) else ""
        )
        df["SectShape"] = df["SectionID"].apply(
            lambda s: sect_info.get(str(int(s)), {}).get("shape", "") if pd.notna(s) else ""
        )

        # 단면 크기 (B, H 또는 D 별도 컬럼)
        def _get_dim(s, key):
            if pd.isna(s):
                return None
            sz = sect_info.get(str(int(s)), {}).get("size", {})
            val = sz.get(key)
            return val * 1000 if val is not None else None

        df["B"] = df["SectionID"].apply(lambda s: _get_dim(s, "B"))
        df["H"] = df["SectionID"].apply(lambda s: _get_dim(s, "H"))
        df["D"] = df["SectionID"].apply(lambda s: _get_dim(s, "D"))

        # D 컬럼이 모두 비어있으면 제거
        if df["D"].isna().all():
            df.drop(columns=["D"], inplace=True)

        # 컬럼 순서 정리 (I → C → J)
        size_cols = [c for c in ["B", "H", "D"] if c in df.columns]
        base_cols = ["Memb", "SectName"] + size_cols + ["SectShape", "LComName", "Type"]
        suffix_order = ["_I", "_C", "_J"]
        force_cols = []
        if force_components is None:
            force_components = ["Fz", "My(-)", "My(+)"]
        for comp in force_components:
            for sfx in suffix_order:
                col = f"{comp}{sfx}"
                if col in df.columns:
                    force_cols.append(col)
        remaining = [c for c in df.columns if c not in base_cols + force_cols + ["SectionID"]]
        df = df[base_cols + force_cols + remaining]
        cls._df_cache = df.copy()
        return df

    # ------------------------------------------------------------------ #
    # STEP 5 · 부재별 최대 부재력 추출
    # ------------------------------------------------------------------ #

    @classmethod
    def to_max_dataframe(
        cls,
        force_components: Optional[list[str]] = None,
        with_section: bool = True,
        group_by: str = "member",
        element_keys: Optional[list[int]] = None,
        section_names: Optional[list[str]] = None,
    ):
        """부재별 또는 단면별 각 부재력의 최대값과 해당 하중조합을 추출한다.

        Parameters
        ----------
        force_components : list[str], optional
            피벗 대상 성분. 기본값 ["Fz", "My(-)", "My(+)"].
        with_section : bool
            True이면 단면정보를 자동 조인.
        group_by : str
            "member" → 부재별 최대값, "section" → 단면별 최대값.
        element_keys : list[int], optional
            특정 요소만 필터링 (Memb 기준). None이면 전체.
        section_names : list[str], optional
            특정 단면명으로 필터링 (SectName 기준). None이면 전체.

        Returns
        -------
        pd.DataFrame
        """
        if not _HAS_PANDAS:
            raise ImportError(
                "pandas가 설치되어 있지 않습니다. `pip install pandas` 후 다시 시도하세요."
            )

        df = cls.to_dataframe(
            force_components=force_components,
            with_section=with_section,
        )
        if df.empty:
            return df

        # 필터링 (전체 캐시에서 특정 요소/단면만 추출)
        if section_names:
            df = df[df["SectName"].isin(section_names)]
        elif element_keys is not None:
            df = df[df["Memb"].isin(element_keys)]
        if df.empty:
            return pd.DataFrame()

        # 부재력 컬럼 식별
        if force_components is None:
            force_components = ["Fz", "My(-)", "My(+)"]
        suffix_order = ["_I", "_C", "_J"]

        if group_by == "section":
            # Section 모드: I단(My(-),My(+),Fz) → C단 → J단
            section_comp_order = ["My(-)", "My(+)", "Fz"]
            force_cols = []
            for sfx in suffix_order:
                for comp in section_comp_order:
                    col = f"{comp}{sfx}"
                    if col in df.columns:
                        force_cols.append(col)
        else:
            # Member 모드: I단(My(-),My(+),Fz) → C단 → J단
            member_comp_order = ["My(-)", "My(+)", "Fz"]
            force_cols = []
            for sfx in suffix_order:
                for comp in member_comp_order:
                    col = f"{comp}{sfx}"
                    if col in df.columns:
                        force_cols.append(col)

        # 문자열 → 숫자 변환
        for col in force_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # 최대값 추출 (group_by에 따라 부재별 또는 단면별)
        group_key = "SectName" if group_by == "section" else "Memb"
        summary_rows = []
        for key, grp in df.groupby(group_key):
            row = {group_key: key}
            if group_key == "SectName":
                row["B"] = grp["B"].iloc[0] if "B" in grp.columns else None
                row["H"] = grp["H"].iloc[0] if "H" in grp.columns else None
                if "D" in grp.columns:
                    row["D"] = grp["D"].iloc[0]
            else:
                row["SectName"] = grp["SectName"].iloc[0] if "SectName" in grp.columns else ""
                row["B"] = grp["B"].iloc[0] if "B" in grp.columns else None
                row["H"] = grp["H"].iloc[0] if "H" in grp.columns else None
                if "D" in grp.columns:
                    row["D"] = grp["D"].iloc[0]
                row["SectShape"] = grp["SectShape"].iloc[0] if "SectShape" in grp.columns else ""

            for col in force_cols:
                idx_max = grp[col].idxmax()
                row[col] = grp.loc[idx_max, col]
                row[f"{col}_LC"] = grp.loc[idx_max, "LComName"]
                row[f"{col}_Memb"] = grp.loc[idx_max, "Memb"]

            summary_rows.append(row)

        df_summary = pd.DataFrame(summary_rows)

        # 컬럼 순서 정리
        size_cols = [c for c in ["B", "H", "D"] if c in df_summary.columns]
        if group_by == "section":
            ordered_cols = ["SectName"] + size_cols
        else:
            ordered_cols = ["Memb", "SectName"] + size_cols + ["SectShape"]
        for col in force_cols:
            if group_by == "section":
                ordered_cols += [f"{col}_LC", col, f"{col}_Memb"]
            else:
                ordered_cols += [col, f"{col}_LC"]
        df_summary = df_summary[[c for c in ordered_cols if c in df_summary.columns]]

        return df_summary

    # ------------------------------------------------------------------ #
    # STEP 6 · Excel 출력
    # ------------------------------------------------------------------ #

    @classmethod
    def to_excel(
        cls,
        filepath: str,
        sheet_name: str = "부재력정리",
        force_components: Optional[list[str]] = None,
        with_section: bool = True,
    ) -> str:
        """부재력 DataFrame을 Excel 파일로 저장한다."""
        df = cls.to_dataframe(
            force_components=force_components,
            with_section=with_section,
        )
        df.to_excel(filepath, sheet_name=sheet_name, index=False)
        return filepath

    # ------------------------------------------------------------------ #
    # 원시 응답 디버깅 헬퍼
    # ------------------------------------------------------------------ #

    @classmethod
    def debug_structure(cls, max_depth: int = 3) -> None:
        """원시 응답의 키 구조를 출력한다 (디버깅용)."""
        def _print(d: Any, indent: int = 0, depth: int = 0) -> None:
            if depth >= max_depth:
                return
            prefix = "  " * indent
            if isinstance(d, dict):
                for k, v in list(d.items())[:8]:
                    if isinstance(v, dict):
                        print(f"{prefix}{k}: dict({len(v)} keys)")
                        _print(v, indent + 1, depth + 1)
                    elif isinstance(v, list):
                        print(f"{prefix}{k}: list({len(v)} items)")
                        if v:
                            _print(v[0], indent + 1, depth + 1)
                    else:
                        print(f"{prefix}{k}: {repr(v)[:80]}")
            elif isinstance(d, list) and d:
                _print(d[0], indent, depth)

        if not cls._raw:
            print("데이터 없음. get()을 먼저 호출하세요.")
            return
        _print(cls._raw)
