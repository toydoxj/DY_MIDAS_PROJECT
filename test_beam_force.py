# -*- coding: utf-8 -*-
"""설계 부재력 추출 테스트 스크립트"""
import os
import sys
import json
import MIDAS_API as MIDAS
from dotenv import load_dotenv

# Windows 콘솔 인코딩 설정
sys.stdout.reconfigure(encoding="utf-8")


def main():
    load_dotenv()

    MIDAS.MIDAS_API_BASEURL(os.environ["MIDAS_BASE_URL"])
    MIDAS.MIDAS_API_KEY(os.environ["MIDAS_API_KEY"])

    # == STEP 1: 단면 정보 ==
    print("=" * 60)
    print("[STEP 1] 단면 정보 조회")
    print("=" * 60)
    MIDAS.sectionDB.get()
    sect_info = MIDAS.sectionDB.info()
    print(f"  단면 수: {len(sect_info)}")
    for sid, info in list(sect_info.items())[:3]:
        print(f"  ID={sid}: {info['name']} ({info['shape']})")

    # == STEP 2: 요소-단면 매핑 ==
    print("\n" + "=" * 60)
    print("[STEP 2] 요소-단면 매핑")
    print("=" * 60)
    MIDAS.elementDB.get()
    elem_map = MIDAS.elementDB.beam_section_map()
    print(f"  보/트러스 요소 수: {len(elem_map)}")
    for eid, sid in list(elem_map.items())[:3]:
        print(f"  Element {eid} -> Section {sid}")

    # == STEP 3: 설계 부재력 조회 ==
    print("\n" + "=" * 60)
    print("[STEP 3] 설계 부재력 조회 (BEAMDESIGNFORCES)")
    print("=" * 60)

    # 전체 보/트러스 요소 조회
    test_keys = list(elem_map.keys())
    print(f"  전체 요소 수: {len(test_keys)}")

    raw = MIDAS.beamForceDB.get(keys=test_keys)

    # 원시 응답 구조 출력
    print("\n  [응답 구조]")
    MIDAS.beamForceDB.debug_structure()

    # 원시 응답 일부 출력
    print(f"\n  [응답 키]: {list(raw.keys())}")
    raw_str = json.dumps(raw, ensure_ascii=False, indent=2)
    if len(raw_str) > 1500:
        print(raw_str[:1500] + "\n  ... (truncated)")
    else:
        print(raw_str)

    # == STEP 4: 파싱 + 피벗 ==
    print("\n" + "=" * 60)
    print("[STEP 4] 파싱 + 피벗")
    print("=" * 60)
    try:
        rows = MIDAS.beamForceDB.parse()
        print(f"  파싱된 행 수: {len(rows)}")
        if rows:
            print(f"  첫 행 키: {list(rows[0].keys())}")
            print(f"  첫 행: {rows[0]}")

        pivoted = MIDAS.beamForceDB.pivot()
        print(f"\n  피벗 행 수: {len(pivoted)}")
        if pivoted:
            print(f"  피벗 첫 행: {pivoted[0]}")
    except Exception as e:
        print(f"  파싱 오류: {e}")

    # == STEP 5: DataFrame + Excel ==
    print("\n" + "=" * 60)
    print("[STEP 5] DataFrame + Excel")
    print("=" * 60)
    try:
        df = MIDAS.beamForceDB.to_dataframe()
        print(df.head(10).to_string())

        out_path = os.path.join(os.path.dirname(__file__), "beam_force_result.xlsx")
        MIDAS.beamForceDB.to_excel(out_path)
        print(f"\n  Excel 저장 완료: {out_path}")
    except Exception as e:
        print(f"  오류: {e}")
        import traceback
        traceback.print_exc()

    # == STEP 6: 부재별 최대 부재력 + 하중조합 ==
    print("\n" + "=" * 60)
    print("[STEP 6] 부재별 최대 부재력 및 해당 하중조합")
    print("=" * 60)
    try:
        import pandas as pd

        df = MIDAS.beamForceDB.to_dataframe()

        # 부재력 컬럼 (F~M 열에 해당)
        force_cols = [c for c in df.columns if any(
            c.startswith(p) for p in ["Fz", "Mx", "My(-)","My(+)"]
        )]
        print(f"  부재력 컬럼: {force_cols}")

        # 문자열 → 숫자 변환
        for col in force_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # 부재별로 각 부재력 컬럼의 최대값 행 추출
        summary_rows = []
        for memb, grp in df.groupby("Memb"):
            row = {"Memb": memb}
            # 단면 정보 (그룹 내 첫 행에서)
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

            summary_rows.append(row)

        df_summary = pd.DataFrame(summary_rows)

        # 컬럼 순서 정리: Memb, 단면, (부재력, 하중조합) 쌍
        size_cols = [c for c in ["B", "H", "D"] if c in df_summary.columns]
        ordered_cols = ["Memb", "SectName"] + size_cols + ["SectShape"]
        for col in force_cols:
            ordered_cols += [col, f"{col}_LC"]
        df_summary = df_summary[[c for c in ordered_cols if c in df_summary.columns]]

        print(df_summary.to_string(index=False))

        out_path2 = os.path.join(os.path.dirname(__file__), "beam_force_max.xlsx")
        df_summary.to_excel(out_path2, index=False)
        print(f"\n  Excel 저장 완료: {out_path2}")

    except Exception as e:
        print(f"  오류: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)


if __name__ == "__main__":
    main()
