---
name: db-node
description: MIDAS GEN NX /db/NODE — 절점(노드) 좌표 데이터. 노드 ID/X/Y/Z 조회·수정.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/35806845654169
---

# /db/NODE — Node

## 목적
모델의 절점(노드) 데이터를 조회·수정한다. 모든 요소(`/db/ELEM`)는 노드 ID 를 참조한다.

## 메소드
GET / POST / PUT / DELETE

## 응답 구조 (요지)
```json
{
  "NODE": {
    "<id>": { "X": 0.0, "Y": 0.0, "Z": 0.0 }
  }
}
```
- 키는 노드 ID (정수 문자열)
- 좌표 단위는 `/db/UNIT` 의 length 설정 (mm 권장)

## 흔한 사용 패턴

### 전체 조회
```python
import MIDAS_API as MIDAS
resp = MIDAS.MidasAPI("GET", "/db/NODE")
nodes = resp.get("NODE", {})
```

### DataFrame 변환
```python
from MIDAS_API import to_dataframe
df = to_dataframe(resp.get("NODE", {}), id_col="ID")
```

## 본 프로젝트 사용 위치
- `MIDAS_API/_node.py` — 캐시 래퍼
- `backend/engines/slab_span.py` — 패널 face detection 입력

## 관련 엔드포인트
- `/db/ELEM` — 노드 ID 참조 (`db-elem.md`)
- `/db/SKEW` — 노드 로컬 축 (인덱스만)
- `/db/UNIT` — 좌표 단위 결정 (인덱스만)

## 공식 문서
https://support.midasuser.com/hc/ko/articles/35806845654169
