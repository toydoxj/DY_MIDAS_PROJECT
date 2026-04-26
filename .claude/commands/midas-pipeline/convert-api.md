---
name: convert-api
description: dyForm 데이터를 MIDAS GEN NX REST API 호출용 JSON 구조로 변환한다. midas-pipeline 2단계.
status: stable
last_reviewed: 2026-04-25
owner: toydoxj
depends_on: [validate-config]
---

# convert-api

## 목적

`dyForm` 데이터를 MIDAS GEN NX REST API 호출용 JSON 구조로 변환한다.

## 전제 조건

- `validate-config.md` 검증이 PASS 상태여야 한다.
- 입력 YAML에 `dyForm`이 존재해야 한다.

## 입력

- 입력 객체: `dyForm`
- 필수 하위 키: `geometry`, `section`, `material`, `load`, `boundary`, `view`

## 출력

- 변환 결과 JSON 객체(메모리 또는 stdout)
  - `modelingInfo`
  - `sections`
  - `materials`
  - `loads`
  - `boundary`
  - `view`

## 실행 절차

1. `dyForm.geometry`를 `modelingInfo`로 매핑한다.
2. `dyForm.section[]`를 `sections[]`로 매핑한다.
   - `name` -> `sectionId` (공백은 `_`로 치환)
   - 치수 필드는 `dimensions`로 묶는다.
3. `dyForm.material[]`을 `materials[]`로 매핑한다.
   - `name` -> `materialId`
   - 물성치는 `properties`로 묶는다.
4. `dyForm.load[]`를 `loads`로 그룹핑한다.
   - 동일 `name`은 하나의 load case로 합산한다.
   - `PointLoad` -> `forces.pointLoad`
   - `DistributedLoad` -> `forces.distributedLoad`
5. `dyForm.boundary[]`를 `boundary[]`로 변환한다.
   - `nodeId`는 문자열로 보정한다.
   - 구속 조건은 6자유도 배열/객체 규칙을 유지한다.
6. `dyForm.view`를 `view`로 매핑한다.
7. 최종 JSON이 직렬화 가능한지 검증한다.

## 실패 기준 및 복구

- 필수 키 누락: 누락된 섹션명을 포함한 오류를 반환한다.
- 식별자 중복: `sectionId`/`materialId` 중복 시 suffix 규칙 또는 사용자 수정 요청을 적용한다.
- 하중 타입 미지원: 지원 목록과 함께 제외/보정 규칙을 출력한다.

## 관련 문서

- `.claude/commands/midas-pipeline/validate-config.md`
- `.claude/commands/midas-pipeline/sort-data.md`

## 마지막 검증

- 검증일: 2026-04-13
- 검증자: Codex
