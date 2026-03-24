분류된 모델 데이터를 지정된 포맷으로 내보낸다.

## 지원 포맷

| 포맷 | 출력 파일 | 상태 |
|------|----------|------|
| json | results/results.json | 구현됨 |
| excel | results/results.xlsx | 미구현 |
| mct | results/results.mct | 미구현 |
| mgb | results/results.mgb | 미구현 |

## JSON 출력 구조

```json
{
  "modeling_info": { "project_name", "analysis_type", "stories", "nodes" },
  "load_cases": [{ "load_case_id", "name", "load_type", "forces" }],
  "members": [{ "member_id", "member_type", "section_id", "material_id", "start_node", "end_node" }],
  "views": [{ "view_name", "view_type", "visibility" }]
}
```

## 실행 방법

1. 4개 모델 데이터(/sort-data 결과)를 입력으로 받는다
2. 지정 포맷(기본: json)으로 변환한다
3. results/ 폴더에 저장한다
4. 저장된 파일 경로와 크기를 출력한다

## 출력 경로
- 기본: `./results/`
- config.yaml의 `outputPath`로 변경 가능
