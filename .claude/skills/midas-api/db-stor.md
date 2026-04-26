---
name: db-stor
description: MIDAS GEN NX /db/STOR — 층(Story) 데이터. STORY_NAME / STORY_LEVEL / Diaphragm / FLOOR_DIAPHRAGM. 내진확인서/슬래브 분석의 층 단위 그룹화에 사용.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/49513466793113
---

# /db/STOR — Story Data

## 목적
모델의 층(Story) 정의 데이터를 조회·수정한다. 노드/요소를 층별로 그룹화하기 위한 기준.

## 메소드
GET / POST / PUT / DELETE

## 응답 구조 (요지)
```json
{
  "STOR": {
    "<id>": {
      "STORY_NAME": "1F",
      "STORY_LEVEL": 0.0,
      "STORY_HEIGHT": 4200.0,
      "bFLOOR_DIAPHRAGM": true,
      "DIAPHRAGM": {...}
    }
  }
}
```

핵심 필드:
- `STORY_LEVEL` — 층의 절대 Z 좌표 (mm)
- `STORY_HEIGHT` — 층고
- `bFLOOR_DIAPHRAGM` — Rigid Diaphragm 적용 여부

## 흔한 사용 패턴

### 층 목록 + 정렬
```python
stor = MIDAS.MidasAPI("GET", "/db/STOR").get("STOR", {})
stories = sorted(stor.values(), key=lambda s: s.get("STORY_LEVEL", 0))
```

### 노드 → 층 매핑
```python
nodes = MIDAS.MidasAPI("GET", "/db/NODE").get("NODE", {})
def find_story(z):
    for s in stories:
        if abs(s["STORY_LEVEL"] - z) < 1.0:
            return s["STORY_NAME"]
    return None
```

## 본 프로젝트 사용 위치
- `backend/routers/analysis.py` — 자중/질량 층별 집계
- `backend/routers/seismic_cert.py` — 내진확인서 층 정보
- `backend/routers/settings.py` — 프로젝트 설정 (X/Y 축렬 + 회전)
- `backend/routers/slab_span.py` — 슬래브 패널 층 분류
- 글로벌 스킬: `midas-stor-story` (스키마 상세)

## 관련 엔드포인트
- `/db/NODE` — Z 좌표로 층 매핑 (`db-node.md`)
- `/db/SPAN` — 경간 정보 (인덱스)

## 공식 문서
https://support.midasuser.com/hc/ko/articles/49513466793113
