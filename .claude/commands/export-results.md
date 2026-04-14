# export-results

## 목적

`sort-data` 결과를 지정 포맷으로 저장하고 산출물 경로를 일관되게 관리한다.

## 전제 조건

- 입력은 `sort-data`의 표준 출력 구조를 따라야 한다.
- `outputPath` 디렉터리가 존재하거나 생성 가능해야 한다.

## 입력

- 분류 결과 객체:
  - `modeling_info`
  - `load_cases`
  - `members`
  - `views`
- 옵션:
  - `exportFormat` (기본: `json`)
  - `outputPath` (기본: `./results/`)

## 출력

- 산출물 파일
  - `json`: `results/results.json` (구현됨)
  - `excel`: `results/results.xlsx` (미구현)
  - `mct`: `results/results.mct` (미구현)
  - `mgb`: `results/results.mgb` (미구현)
- 출력 메타: 저장 경로, 파일 크기, 생성 시각

## 실행 절차

1. 입력 데이터 구조가 표준 키를 모두 갖는지 검증한다.
2. `exportFormat`에 맞는 serializer를 선택한다.
3. `outputPath`를 확정한다. (`formConfig.outputPath` 우선, 없으면 기본값)
4. 파일을 저장하고 경로/크기를 출력한다.

## JSON 출력 구조

```json
{
  "modeling_info": { "project_name": "", "analysis_type": "", "stories": [], "nodes": {} },
  "load_cases": [{ "load_case_id": "", "name": "", "load_type": "", "forces": {} }],
  "members": [{ "member_id": "", "member_type": "", "section_id": "", "material_id": "", "start_node": "", "end_node": "" }],
  "views": [{ "view_name": "", "view_type": "", "visibility": {} }]
}
```

## 실패 기준 및 복구

- 미구현 포맷 요청: 지원 포맷 목록(`json`)을 안내하고 fallback 여부를 선택한다.
- 파일 저장 실패: 경로 권한/존재 여부 확인 후 재시도한다.

## 관련 문서

- `.claude/commands/sort-data.md`
- `.claude/commands/validate-config.md`

## 마지막 검증

- 검증일: 2026-04-13
- 검증자: Codex
