---
name: db-fbla
description: MIDAS GEN NX /db/FBLA — Assign Floor Loads. 바닥하중 영역(다각형) + 분포하중 정의. Load Map 페이지의 핵심 데이터.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/35953653792665
---

# /db/FBLA — Assign Floor Loads

## 목적
바닥하중을 적용할 영역(다각형)과 적용된 하중을 조회·수정한다. Load Map 페이지의 폴리곤 + Wu 계산 입력.

## 메소드
GET / POST / PUT / DELETE

## 응답 구조 (요지)
```json
{
  "FBLA": {
    "<id>": {
      "NODES": [101, 102, 103, 104],   // 다각형 절점 ID 배열 (시계/반시계)
      "FLOAD": [                        // 적용 하중 목록
        {"FLT": "FBLD_DL", "AFAC": 1.0},
        {"FLT": "FBLD_LL", "AFAC": 1.0}
      ],
      "iSDIR": 1,                        // 분배 방향 (1=X, 2=Y, 0=양방향)
      "iSEDS": 1                         // Edge 분배 방식
    }
  }
}
```

## 흔한 사용 패턴

### 패널별 다각형 좌표
```python
nodes = MIDAS.MidasAPI("GET", "/db/NODE").get("NODE", {})
fblas = MIDAS.MidasAPI("GET", "/db/FBLA").get("FBLA", {})
for fid, f in fblas.items():
    polygon = [(nodes[str(n)]["X"], nodes[str(n)]["Y"]) for n in f["NODES"]]
```

### Wu 계산 (FBLD 와 결합)
```python
fblds = MIDAS.MidasAPI("GET", "/db/FBLD").get("FBLD", {})  # 하중 정의
for fid, f in fblas.items():
    DL = LL = 0
    for fl in f.get("FLOAD", []):
        flt = fl["FLT"]
        for bid, b in fblds.items():
            if b.get("NAME") == flt:
                if b.get("LCT") in ("DL", "D"): DL += b.get("FLOAD", 0)
                if b.get("LCT") in ("LL", "L"): LL += b.get("FLOAD", 0)
    Wu = 1.2 * DL + 1.6 * LL
```

## 본 프로젝트 사용 위치
- `MIDAS_API/_floor_assign.py` — 캐시 래퍼
- `backend/engines/load_map_dxf.py` — DXF 출력 (FBLA 영역 + 솔리드 해치)
- `backend/engines/slab_span.py` — Floor Load 매칭 (point-in-polygon)
- frontend `loadcase/load-map` — 다각형 + Wu 시각화

## 관련 엔드포인트
- `/db/FBLD` — Floor Load Define (인덱스, FBLA 가 참조)
- `/db/NODE` — 다각형 절점 좌표 (`db-node.md`)
- `/db/STLD` — Static Load Cases (`db-stld.md`)
- `/db/CO_F` — Floor Load Color (인덱스)

## 공식 문서
https://support.midasuser.com/hc/ko/articles/35953653792665
