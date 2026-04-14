# validate-config

## 목적

`config.yaml`의 `formConfig`/`dyForm` 구조를 사전에 검증해 변환 및 API 호출 실패를 방지한다.

## 전제 조건

- 입력 파일은 UTF-8 YAML이어야 한다.
- 최상위에 `formConfig`, `dyForm` 키가 있어야 한다.

## 입력

- 파일 경로: 기본 `config.yaml` 또는 사용자 지정 YAML 경로
- 필수 키 계약:
  - `formConfig`: `exportFormat`, `outputPath`
  - `dyForm`: `geometry`, `section`, `material`, `load`, `boundary`, `view`

## 출력

- 검증 결과 테이블: `항목 | 상태(PASS/FAIL) | 비고`
- FAIL 항목이 있으면 수정 가이드 목록

## 실행 절차

1. YAML 파일을 읽고 파싱 오류 여부를 확인한다.
2. 최상위 키(`formConfig`, `dyForm`) 존재 여부를 확인한다.
3. `dyForm` 하위 6개 필수 항목 존재 여부를 확인한다.
4. `geometry.origin`이 dict인지 확인한다.
5. `section`, `material` 배열 각 항목의 `name`, `type`을 확인한다.
6. `load` 배열 각 항목의 `name`, `type`, `value`를 확인한다.
7. `formConfig.exportFormat` 허용값(`json`, `excel`, `mct`, `mgb`)을 확인한다.
8. `formConfig.outputPath`가 문자열 경로인지 확인한다.

## 실패 기준 및 복구

- YAML 파싱 실패: 들여쓰기/콜론/따옴표 오류를 수정한다.
- 필수 키 누락: 누락된 키를 최소 스키마로 채운다.
- 타입 불일치: dict/array/string 기대 타입으로 수정한다.

## 관련 문서

- `.claude/commands/convert-api.md`
- `.claude/commands/export-results.md`

## 마지막 검증

- 검증일: 2026-04-13
- 검증자: Codex
