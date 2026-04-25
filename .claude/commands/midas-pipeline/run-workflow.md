---
name: run-workflow
description: MIDAS 자동화 파이프라인의 표준 실행 순서와 단계 간 데이터 계약을 정의한다. midas-pipeline 3단계 (오케스트레이터).
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
depends_on: [convert-api]
---

# run-workflow

## 목적

MIDAS 자동화 파이프라인의 표준 실행 순서와 단계 간 데이터 계약을 정의한다.

## 전제 조건

- 가상환경이 활성화되어 있어야 한다.
- `.env`에 `MIDAS_BASE_URL`, `MIDAS_API_KEY`가 설정되어 있어야 한다.
- MIDAS GEN NX가 실행 중이어야 한다.

## 입력

- 설정 파일: `config.yaml` 또는 사용자 지정 YAML 파일 1개
- 필수 최상위 키: `formConfig`, `dyForm`

## 출력

- 최종 결과 파일: `results/results.json` (기본)
- 단계별 로그: 검증/변환/분류/내보내기 상태 메시지

## 실행 절차

1. Config Load: 설정 파일을 로드한다.
2. Validation: `validate-config.md` 기준으로 스키마를 검증한다.
3. API Conversion: `convert-api.md` 규칙으로 MIDAS 요청 포맷으로 변환한다.
4. MIDAS Communication: MIDAS API 호출 및 해석 실행을 수행한다.
5. Data Sorting: `sort-data.md` 기준으로 4개 모델로 분류한다.
6. Export Results: `export-results.md` 기준으로 결과를 파일로 저장한다.

## 실패 기준 및 복구

- 필수 필드 누락 시 즉시 중단하고 누락 키 목록을 출력한다.
- MIDAS 통신 실패 시 상태코드/응답 본문을 출력하고 재시도 여부를 명시한다.
- 저장 실패 시 출력 경로 권한과 디렉터리 존재 여부를 먼저 점검한다.

## 관련 문서

- `.claude/commands/midas-pipeline/validate-config.md`
- `.claude/commands/midas-pipeline/convert-api.md`
- `.claude/commands/midas-pipeline/sort-data.md`
- `.claude/commands/midas-pipeline/export-results.md`

## 마지막 검증

- 검증일: 2026-04-13
- 검증자: Codex
