---
name: midas-api-json
description: MIDAS GEN NX REST API 인덱스 허브. 자주 쓰는 6개 엔드포인트는 별도 db-*.md 분할, 나머지는 공식 문서 링크.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
source: https://support.midasuser.com/hc/ko/articles/33016922742937
---

# MIDAS GEN NX API — 인덱스

공식: https://support.midasuser.com/hc/ko/articles/33016922742937

## 섹션 구조 (5 카테고리, 총 약 320 엔드포인트)

| 섹션 | 설명 | Method | 엔드포인트 수 |
|------|------|--------|---------------|
| DOC  | 문서 관리 (열기/저장/해석) | POST | 11 |
| DB   | 데이터베이스 (모델 데이터)  | GET/POST/PUT/DELETE | 246 |
| OPE  | 운영/계산 | POST | 13 |
| VIEW | 뷰/화면 제어 | POST | 40 |
| POST | 후처리 결과 조회 | POST | 10 + (TABLE 121) |

## 자주 쓰는 엔드포인트 (분할 파일)

| Endpoint | 용도 | 본 프로젝트 핵심 사용 | 분할 파일 |
|----------|------|----------------------|-----------|
| `/db/NODE` | 절점 좌표 | slab_span / 좌표 매핑 | [`db-node.md`](./db-node.md) |
| `/db/ELEM` | 요소(보/기둥/벽/슬래브) | 부재 분류 / face detection | [`db-elem.md`](./db-elem.md) |
| `/db/SECT` | 단면 속성 (17 변형) | RC 보 b·D 추출 | [`db-sect.md`](./db-sect.md) |
| `/db/STLD` | 정적 하중 케이스 | 내진/풍/사하중 분류 | [`db-stld.md`](./db-stld.md) |
| `/db/STOR` | 층 데이터 | 층별 그룹화 | [`db-stor.md`](./db-stor.md) |
| `/db/FBLA` | 바닥하중 영역 | Load Map 폴리곤 + Wu | [`db-fbla.md`](./db-fbla.md) |

## 분할되지 않은 엔드포인트

본 프로젝트에서 사용 빈도가 낮은 ~314 개는 별도 파일을 만들지 않았다. 사용 시:

1. 공식 문서: https://support.midasuser.com/hc/ko/articles/33016922742937
2. 관련 도메인 스킬에서 즉석 발췌 — 예: `/db/COMB` 사용 시 글로벌 스킬 `midas-gen-nx-api` 참조
3. 깊은 스키마가 필요하면 본 디렉토리에 새 `db-<name>.md` 추가 (frontmatter 표준 준수)

자주 등장하지만 분할 안 된 것:
- `/db/MATL` (재료), `/db/THIK` (두께), `/db/COMB` (하중조합), `/db/FBLD` (Floor Load 정의), `/db/UNIT` (단위), `/db/PJCF` (프로젝트 정보)

## 응답 후처리 보조 스킬

- `schema-eigenvalue.md` — `/post/TABLE` 고유치 결과 요청 스키마 예시
- `MIDAS_API/_to_excel.py` — `dict_to_rows()` / `to_dataframe()` 평탄화

## 글로벌 보완 스킬

- `midas-api` — Civil NX Python 라이브러리 자동화
- `midas-gen-nx-api` — 전체 엔드포인트 검색 허브
- `midas-stor-story` — `/db/STOR` 스키마 상세
