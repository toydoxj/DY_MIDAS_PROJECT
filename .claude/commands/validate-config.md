config.yaml 또는 지정된 설정 파일의 FormConfig/DY_Form 구조를 검증한다.

## 검증 항목

1. **필수 최상위 필드**: `formConfig`, `dyForm` 존재 여부
2. **DY_Form 6개 필수 항목**: `geometry`, `section`, `material`, `load`, `boundary`, `view`
3. **geometry 구조**: `origin` 필드 존재 및 dict 타입 확인
4. **section/material**: 각 항목에 `name`, `type` 필드 존재
5. **load**: `name`, `type`, `value` 필드 존재
6. **exportFormat/outputPath**: 유효한 포맷 및 경로

## 실행 방법

1. config.yaml (또는 인자로 받은 파일)을 읽는다
2. 위 항목을 순서대로 검증한다
3. 검증 결과를 테이블 형태로 출력한다 (항목 | 상태 | 비고)
4. 오류가 있으면 수정 방법을 제안한다

## 참고
- DY_Form 스키마: memory의 project_dyform_concept.md
- config 템플릿: config/templates/*.yaml
