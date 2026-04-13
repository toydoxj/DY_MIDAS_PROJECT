from __future__ import annotations

import logging
from typing import Any, Optional

from ._midas_api import MidasAPI
from ._section import sectionDB
from ._element import elementDB

try:
    import pandas as pd
    _HAS_PANDAS = True
except ImportError:
    _HAS_PANDAS = False

logger = logging.getLogger("midas_api.beam_force")

# 기본 COMPONENTS
_DEFAULT_COMPONENTS = ["Memb", "Part", "LComName", "Type", "Fz", "My(-)", "My(+)"]


def _safe_int(val: Any) -> int:
    """안전한 int 변환 (실패 시 -1)."""
    try:
        return int(val)
    except (TypeError, ValueError):
        return -1


class beamForceDB:
    """설계 부재력 추출 (POST /post/table — BEAMDESIGNFORCES)

    누적 캐싱: 조회된 element ID를 기억하고, 새로운 ID만 추가 조회한다.
    """
    _rows: list[dict[str, Any]] = []       # 누적된 행 리스트
    _cached_keys: set[int] = set()          # 이미 조회된 element ID
    _loaded_all: bool = False               # 전체 조회 완료 여부
    _df_cache: Any = None                   # to_dataframe() 캐시

    # 기본 조회 옵션 (변경 시 캐시 무효화)
    _opts: dict[str, Any] = {}

    # ------------------------------------------------------------------ #
    # 캐시 관리
    # ------------------------------------------------------------------ #

    @classmethod
    def clear_cache(cls) -> None:
        """캐시 전체 초기화."""
        cls._rows = []
        cls._cached_keys = set()
        cls._loaded_all = False
        cls._df_cache = None
        cls._opts = {}

    @classmethod
    def _invalidate_df(cls) -> None:
        """DataFrame 캐시만 무효화 (행 추가 시)."""
        cls._df_cache = None

    @classmethod
    def _build_opts(
        cls,
        parts: Optional[list[str]],
        components: Optional[list[str]],
        force_unit: str,
        dist_unit: str,
        fmt: str,
        place: int,
    ) -> dict[str, Any]:
        return {
            "parts": parts or ["PartI", "Part2/4", "PartJ"],
            "components": components or list(_DEFAULT_COMPONENTS),
            "force_unit": force_unit,
            "dist_unit": dist_unit,
            "fmt": fmt,
            "place": place,
        }

    # ------------------------------------------------------------------ #
    # STEP 1 · 설계 부재력 조회 (누적 캐싱)
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
    ) -> list[dict[str, Any]]:
        """설계 부재력을 조회한다 (누적 캐싱).

        이미 조회된 element는 재조회하지 않고 캐시에서 반환한다.
        새로운 element만 API에 요청하여 캐시에 누적한다.

        Parameters
        ----------
        keys : list[int], optional
            조회할 요소 ID 목록. None이면 전체.
        """
        opts = cls._build_opts(parts, components, force_unit, dist_unit, fmt, place)

        # 옵션이 바뀌면 캐시 전체 초기화
        if cls._opts and cls._opts != opts:
            logger.info("조회 옵션 변경 — 캐시 초기화")
            cls.clear_cache()
        cls._opts = opts

        # 전체 조회 완료 상태면 캐시 반환
        if cls._loaded_all:
            return cls._rows

        # 조회할 키 결정
        if keys is None:
            # 전체 조회
            fetch_keys = None
        else:
            # 이미 캐시된 키 제외
            new_keys = [k for k in keys if k not in cls._cached_keys]
            if not new_keys:
                logger.debug("모든 키가 캐시에 있음 — API 호출 생략")
                return cls._rows
            fetch_keys = new_keys

        # API 호출
        argument: dict[str, Any] = {
            "TABLE_TYPE": "BEAMDESIGNFORCES",
            "UNIT": {
                "FORCE": opts["force_unit"],
                "DIST": opts["dist_unit"],
            },
            "STYLES": {
                "FORMAT": opts["fmt"],
                "PLACE": opts["place"],
            },
            "PARTS": opts["parts"],
            "COMPONENTS": opts["components"],
        }

        if fetch_keys:
            argument["NODE_ELEMS"] = {"KEYS": fetch_keys}

        body = {"Argument": argument}
        result = MidasAPI("POST", "/post/table", body)

        # 응답 파싱 → 행 리스트
        new_rows = cls._parse_response(result)

        if keys is None:
            # 전체 조회: 캐시 교체
            cls._rows = new_rows
            cls._cached_keys = {
                int(r.get("Memb", r.get("Element", 0)))
                for r in new_rows if r.get("Memb") or r.get("Element")
            }
            cls._loaded_all = True
        else:
            # 부분 조회: 캐시에 누적
            cls._rows.extend(new_rows)
            cls._cached_keys.update(fetch_keys)

        cls._invalidate_df()

        n_fetched = len(fetch_keys) if fetch_keys else "전체"
        logger.info("부재력 조회: %s개 요소 → %s행 추가 (캐시 총 %s행)",
                     n_fetched, len(new_rows), len(cls._rows))

        return cls._rows

    @classmethod
    def ensure_keys(cls, keys: list[int], **kwargs) -> list[dict[str, Any]]:
        """지정된 keys가 캐시에 있도록 보장한다."""
        return cls.get(keys=keys, **kwargs)

    @classmethod
    def ensure_loaded_all(cls, **kwargs) -> list[dict[str, Any]]:
        """전체 부재력이 캐시에 없으면 한 번에 조회한다."""
        if not cls._loaded_all:
            cls.get(keys=None, **kwargs)
        return cls._rows

    # ------------------------------------------------------------------ #
    # STEP 2 · 응답 파싱 → 행 리스트
    # ------------------------------------------------------------------ #

    @staticmethod
    def _parse_response(raw: dict) -> list[dict[str, Any]]:
        """원시 API 응답을 행 리스트로 변환한다."""
        # 응답 구조 탐색: 다양한 키 패턴 대응
        table_data = raw.get("BEAMDESIGNFORCES", {})
        if not table_data:
            table_data = raw.get("BeamDesignForces", {})
        if not table_data:
            table_data = raw.get("DATA", raw.get("data", {}))
        if not table_data:
            for v in raw.values():
                if isinstance(v, (dict, list)):
                    table_data = v
                    break

        if isinstance(table_data, dict):
            if "HEAD" in table_data and "DATA" in table_data:
                head = table_data["HEAD"]
                data = table_data["DATA"]
                rows: list[dict[str, Any]] = []
                for record in data:
                    row = {}
                    for i, col in enumerate(head):
                        row[col] = record[i] if i < len(record) else None
                    rows.append(row)
                return rows
            else:
                rows = []
                for key, value in table_data.items():
                    if isinstance(value, dict):
                        row = {"Index": key}
                        row.update(value)
                        rows.append(row)
                return rows
        elif isinstance(table_data, list):
            return list(table_data)

        return []

    # ------------------------------------------------------------------ #
    # STEP 3 · i단/j단 피벗 (한 행에 I/J 컬럼)
    # ------------------------------------------------------------------ #

    @classmethod
    def pivot(
        cls,
        force_components: Optional[list[str]] = None,
        rows: Optional[list[dict[str, Any]]] = None,
    ) -> list[dict[str, Any]]:
        """행 리스트를 Memb+LComName 기준으로 PartI/PartJ 컬럼을 피벗한다."""
        if rows is None:
            rows = cls._rows
        if not rows:
            return []

        if force_components is None:
            force_components = ["Fz", "My(-)", "My(+)"]

        part_suffix_map = {
            "I": "_I",
            "J": "_J",
            "1/2": "_C",
            "2/4": "_C",
            "I/4": "_Q1",
            "3/4": "_Q3",
            "PARTI": "_I",
            "PARTJ": "_J",
            "PART1/2": "_C",
            "PARTI/4": "_Q1",
            "PART3/4": "_Q3",
        }

        grouped: dict[tuple, dict[str, Any]] = {}
        for row in rows:
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
        """피벗된 부재력에 단면정보를 조인하여 DataFrame으로 반환한다."""
        if not _HAS_PANDAS:
            raise ImportError(
                "pandas가 설치되어 있지 않습니다. `pip install pandas` 후 다시 시도하세요."
            )

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
    # STEP 5 · 부재별 최대 부재력 추출 (요청 element만 직접 처리)
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

        전체 DataFrame을 거치지 않고 요청된 element의 행만 직접 처리한다.
        """
        if not _HAS_PANDAS:
            raise ImportError(
                "pandas가 설치되어 있지 않습니다. `pip install pandas` 후 다시 시도하세요."
            )

        # ---- 1. 캐시에서 요청 element만 필터링 ----
        elem_map = elementDB.beam_section_map() if with_section else {}
        sect_info = sectionDB.info() if with_section else {}

        target_elem_set: Optional[set[int]] = None
        if element_keys:
            target_elem_set = set(element_keys)
        elif section_names and with_section:
            name_to_sect_id: dict[str, int] = {
                v.get("name", ""): int(k) for k, v in sect_info.items()
            }
            target_sect_ids = {name_to_sect_id[n] for n in section_names if n in name_to_sect_id}
            target_elem_set = {eid for eid, sid in elem_map.items() if sid in target_sect_ids}

        if target_elem_set is not None:
            filtered_rows = [
                r for r in cls._rows
                if _safe_int(r.get("Memb", r.get("Element"))) in target_elem_set
            ]
        else:
            filtered_rows = cls._rows

        if not filtered_rows:
            return pd.DataFrame()

        # ---- 2. 피벗 (요청 행만) ----
        pivoted = cls.pivot(force_components=force_components, rows=filtered_rows)
        df = pd.DataFrame(pivoted)
        if df.empty:
            return df

        # ---- 3. 단면정보 JOIN (필요시) ----
        if with_section and elem_map:
            df["SectionID"] = df["Memb"].apply(
                lambda e: elem_map.get(int(e), None) if e is not None else None
            )
            df["SectName"] = df["SectionID"].apply(
                lambda s: sect_info.get(str(int(s)), {}).get("name", "") if pd.notna(s) else ""
            )
            df["SectShape"] = df["SectionID"].apply(
                lambda s: sect_info.get(str(int(s)), {}).get("shape", "") if pd.notna(s) else ""
            )

            def _get_dim(s, key):
                if pd.isna(s):
                    return None
                sz = sect_info.get(str(int(s)), {}).get("size", {})
                val = sz.get(key)
                return val * 1000 if val is not None else None

            df["B"] = df["SectionID"].apply(lambda s: _get_dim(s, "B"))
            df["H"] = df["SectionID"].apply(lambda s: _get_dim(s, "H"))
            df["D"] = df["SectionID"].apply(lambda s: _get_dim(s, "D"))
            if "D" in df.columns and df["D"].isna().all():
                df.drop(columns=["D"], inplace=True)

        # section_names 최종 필터 (JOIN 후)
        if section_names and "SectName" in df.columns:
            df = df[df["SectName"].isin(section_names)]
        if df.empty:
            return pd.DataFrame()

        # ---- 4. 부재력 컬럼 식별 ----
        if force_components is None:
            force_components = ["Fz", "My(-)", "My(+)"]
        comp_order = ["My(-)", "My(+)", "Fz"]
        suffix_order = ["_I", "_C", "_J"]
        force_cols = []
        for sfx in suffix_order:
            for comp in comp_order:
                col = f"{comp}{sfx}"
                if col in df.columns:
                    force_cols.append(col)

        for col in force_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # ---- 5. 최대값 + 하중조합명 추출 ----
        group_key = "SectName" if group_by == "section" else "Memb"
        summary_rows = []
        for key, grp in df.groupby(group_key):
            row: dict[str, Any] = {group_key: key}
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

        # ---- 6. 컬럼 순서 정리 ----
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
        """캐시 상태를 출력한다 (디버깅용)."""
        print(f"캐시 행 수: {len(cls._rows)}")
        print(f"캐시된 요소 수: {len(cls._cached_keys)}")
        print(f"전체 로드 완료: {cls._loaded_all}")
        if cls._rows:
            print(f"첫 행 키: {list(cls._rows[0].keys())}")
