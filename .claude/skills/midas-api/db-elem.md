---
name: db-elem
description: MIDAS GEN NX /db/ELEM — 요소(부재) 정의. TYPE(BEAM/COLUMN/WALL/PLATE 등) + 노드 연결 + 단면/재료 ID.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/35806934300825
---

# /db/ELEM — Element

## 목적
모델의 요소(부재) 데이터를 조회·수정한다. 보/기둥/벽/슬래브 등 모든 부재가 여기에 등록된다.

## 메소드
GET / POST / PUT / DELETE

## 응답 구조 (요지)
```json
{
  "ELEM": {
    "<id>": {
      "TYPE": "BEAM",          // BEAM | COLUMN | TRUSS | PLATE | WALL ...
      "MATL": 1,                // 재료 ID (/db/MATL)
      "SECT": 12,               // 단면 ID (/db/SECT)
      "NODE": [101, 102],       // 절점 ID 배열
      "ANGLE": 0.0
    }
  }
}
```
- TYPE 별로 NODE 배열 길이가 다름 (BEAM=2, PLATE=3 또는 4)

## 흔한 사용 패턴

### TYPE 별 필터링
```python
elems = MIDAS.MidasAPI("GET", "/db/ELEM").get("ELEM", {})
beams   = {k: v for k, v in elems.items() if v.get("TYPE") == "BEAM"}
columns = {k: v for k, v in elems.items() if v.get("TYPE") == "COLUMN"}
plates  = {k: v for k, v in elems.items() if v.get("TYPE") == "PLATE"}
```

### 노드 좌표와 결합
```python
nodes = MIDAS.MidasAPI("GET", "/db/NODE").get("NODE", {})
for eid, e in beams.items():
    n1, n2 = e["NODE"]
    p1 = nodes[str(n1)]; p2 = nodes[str(n2)]
```

## 본 프로젝트 사용 위치
- `MIDAS_API/_element.py` — 캐시 래퍼
- `backend/engines/slab_span.py` — 보/기둥 위치 → 패널 그래프
- `backend/routers/slab_span.py` — 패널 face detection
- `backend/engines/seismic_cert_hwpx.py` — 부재 카운트

## 관련 엔드포인트
- `/db/NODE` — 노드 좌표 (`db-node.md`)
- `/db/SECT` — 단면 (`db-sect.md`)
- `/db/MATL` — 재료 (인덱스)

## 공식 문서
https://support.midasuser.com/hc/ko/articles/35806934300825
