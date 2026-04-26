---
name: db-sect
description: MIDAS GEN NX /db/SECT — 단면 속성 (Common, DB/User, Value, SRC, PSC, Composite, Tapered 등 17개 변형). RC 보/기둥 단면 b·D 추출.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/35808653964185
---

# /db/SECT — Section Properties (17 변형)

## 목적
모델의 단면 속성을 조회·수정한다. 보/기둥의 폭(b)과 깊이(D) 등 부재 검토에 필수.

## 메소드
GET / POST / PUT / DELETE

## 17 변형 (모두 같은 엔드포인트, SECTTYPE 으로 구분)

| # | SECTTYPE / 카테고리 | 용도 | 공식 링크 |
|---|---------------------|------|-----------|
| 29 | Common | 공통 | [Link](https://support.midasuser.com/hc/ko/articles/35808653964185) |
| 30 | DB/User | DB 또는 사용자 정의 | [Link](https://support.midasuser.com/hc/ko/articles/35809067039513) |
| 31 | Value | 값 직접 입력 | [Link](https://support.midasuser.com/hc/ko/articles/35839753881497) |
| 32 | SRC | 합성단면(Steel-Reinforced Concrete) | [Link](https://support.midasuser.com/hc/ko/articles/35845378225689) |
| 33 | Combined | 조합 | [Link](https://support.midasuser.com/hc/ko/articles/35851350827801) |
| 34 | PSC | PSC 단면 | [Link](https://support.midasuser.com/hc/ko/articles/35851688190105) |
| 35 | PSC Value | PSC 값 입력 | [Link](https://support.midasuser.com/hc/ko/articles/39233604772633) |
| 36 | Composite-PSC | 합성 PSC | [Link](https://support.midasuser.com/hc/ko/articles/35938998724377) |
| 37 | Composite-Steel | 합성 강재 | [Link](https://support.midasuser.com/hc/ko/articles/35939122737689) |
| 38 | Steel Girder | 강 거더 | [Link](https://support.midasuser.com/hc/ko/articles/35939506348697) |
| 39 | Tapered-DB/User | 변단면 | [Link](https://support.midasuser.com/hc/ko/articles/35852806893593) |
| 40 | Tapered-Value | 변단면 값 | [Link](https://support.midasuser.com/hc/ko/articles/35938685208089) |
| 41 | Tapered-PSC | 변단면 PSC | [Link](https://support.midasuser.com/hc/ko/articles/35941360898713) |
| 42 | Tapered-PSC Value | 변단면 PSC 값 | [Link](https://support.midasuser.com/hc/ko/articles/39233752695321) |
| 43 | Tapered-Composite PSC | 변단면 합성 PSC | [Link](https://support.midasuser.com/hc/ko/articles/35941514067225) |
| 44 | Tapered-Composite Steel | 변단면 합성 강재 | [Link](https://support.midasuser.com/hc/ko/articles/35941644806553) |
| 45 | Tapered-Steel Girder | 변단면 강 거더 | [Link](https://support.midasuser.com/hc/ko/articles/35941809011225) |

본 프로젝트(RC 보/기둥)는 **DB/User (30)** 또는 **Value (31)** 사용 빈도 최상.

## 응답 구조 (요지, RC 직사각형 단면)
```json
{
  "SECT": {
    "<id>": {
      "SECTTYPE": "DBUSER",
      "SECT_NAME": "G1-400x700",
      "SECT_BEFORE": {
        "DATA1": 400,    // b (mm)
        "DATA2": 700     // D (mm)
      }
    }
  }
}
```

## 흔한 사용 패턴

### b, D 추출 (RC 보)
```python
sects = MIDAS.MidasAPI("GET", "/db/SECT").get("SECT", {})
for sid, s in sects.items():
    name = s.get("SECT_NAME", "")
    data = s.get("SECT_BEFORE", {})
    b = data.get("DATA1")
    D = data.get("DATA2")
```

## 본 프로젝트 사용 위치
- `MIDAS_API/_section.py` — 캐시 래퍼
- `backend/routers/member.py` — 단면 조회 (RC 보 검토)

## 관련 엔드포인트
- `/db/ELEM` — 단면 ID 참조 (`db-elem.md`)
- `/db/THIK` — 슬래브/벽 두께 (인덱스)
- `/db/MATL` — 재료 (인덱스)

## 공식 문서
https://support.midasuser.com/hc/ko/articles/35808653964185
