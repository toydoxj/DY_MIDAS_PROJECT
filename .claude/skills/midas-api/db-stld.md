---
name: db-stld
description: MIDAS GEN NX /db/STLD — 정적 하중 케이스. TYPE 약자 D/L/W/WA/EH 등으로 종류 구분. 내진/풍/사하중 분류에 필수.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/35952651947801
---

# /db/STLD — Static Load Cases

## 목적
정적 하중 케이스(Dead, Live, Wind, Earthquake 등)를 조회·수정한다. 내진검토/하중조합/Load Map 의 입력 분류 기반.

## 메소드
GET / POST / PUT / DELETE

## 응답 구조 (요지)
```json
{
  "STLD": {
    "<id>": {
      "NAME": "DL",
      "TYPE": "D",            // 하중 종류 (아래 TYPE 표 참조)
      "DESC": "Dead Load"
    }
  }
}
```

## TYPE 약자 매핑 (project_stld_schema.md 메모리 기반)

| TYPE | 의미 | 한글 |
|------|------|------|
| D | Dead | 사하중 |
| L | Live | 활하중 |
| W | Wind | 풍하중 |
| WA | Wave | 파압 |
| EH | Earthquake | 지진하중 |

기타 TYPE(SD, SDL, ROOF, S, T, IL, ER, LR ...) 은 공식 문서 참조.

## 흔한 사용 패턴

### TYPE 별 필터링
```python
stld = MIDAS.MidasAPI("GET", "/db/STLD").get("STLD", {})
dead    = {k: v for k, v in stld.items() if v.get("TYPE") == "D"}
live    = {k: v for k, v in stld.items() if v.get("TYPE") == "L"}
seismic = {k: v for k, v in stld.items() if v.get("TYPE") == "EH"}
```

## 본 프로젝트 사용 위치
- `backend/routers/loadcase.py` — 하중케이스 목록 + TYPE 분류
- `backend/routers/seismic_cert.py` — 지진하중(EH) 검색
- `MIDAS_API/_loads.py` — 캐시 래퍼

## 관련 엔드포인트
- `/db/COMB` — 하중 조합 (인덱스)
- `/db/FBLA` — 바닥하중 영역 (`db-fbla.md`)
- `/db/LDGR` — 하중 그룹 (인덱스)

## 공식 문서
https://support.midasuser.com/hc/ko/articles/35952651947801
