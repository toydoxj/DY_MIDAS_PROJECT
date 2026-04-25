---
name: sort-data
description: MIDAS API 응답 데이터를 4개 표준 모델로 분류해 후속 저장/리포트 단계에서 재사용한다. midas-pipeline 4단계.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
depends_on: [run-workflow]
---

# sort-data

## 목적

MIDAS API 응답 데이터를 4개 표준 모델로 분류해 후속 저장/리포트 단계에서 재사용한다.

## 전제 조건

- MIDAS 통신 단계가 정상 완료되어 응답 JSON dict가 준비되어 있어야 한다.

## 입력

- 입력 객체: MIDAS API 응답(JSON dict)
- 기대 원천: 모델 정보/하중/부재/뷰 관련 필드를 포함한 응답

## 출력

- 분류 객체(JSON):
  - `modeling_info`
  - `load_cases`
  - `members`
  - `views`
- 요약 정보: 카테고리별 건수 테이블

## 실행 절차

1. 입력 dict에서 모델 메타데이터를 추출해 `modeling_info`로 저장한다.
2. 하중 관련 필드를 추출해 `load_cases[]`로 정규화한다.
3. 부재 관련 필드를 추출해 `members[]`로 정규화한다.
4. 뷰/표시 관련 필드를 추출해 `views[]`로 정규화한다.
5. 각 카테고리 건수와 누락 항목 여부를 요약 출력한다.

## 분류 기준

### modeling_info

- `project_name`
- `analysis_type`
- `stories`
- `nodes`

### load_cases

- `load_case_id`
- `name`
- `load_type`
- `forces`

### members

- `member_id`
- `member_type`
- `section_id`
- `material_id`
- `start_node`
- `end_node`

### views

- `view_name`
- `view_type`
- `visibility`

## 실패 기준 및 복구

- 필수 카테고리 누락: 누락 카테고리명을 명시하고 빈 구조로 초기화 여부를 선택한다.
- 키 매핑 실패: 원본 키와 목표 키를 매핑 테이블로 출력해 수동 보정한다.

## 관련 문서

- `.claude/commands/midas-pipeline/export-results.md`

## 마지막 검증

- 검증일: 2026-04-13
- 검증자: Codex
