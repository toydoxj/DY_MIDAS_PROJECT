MIDAS API 응답 데이터를 4개 모델로 분류하여 정리한다.

## 4개 모델 분류 기준

### 1. ModelingInfo
- `project_name`: 프로젝트 이름
- `analysis_type`: 해석 유형 (Static, Eigen, ResponseSpectrum, TimeHistory)
- `stories`: 층 목록
- `nodes`: 노드 좌표 dict

### 2. LoadCase
- `load_case_id`: 하중 조합 ID
- `name`: 하중 이름
- `load_type`: 하중 유형
- `forces`: 하중 값 (Fx, Fy, Fz, Mx, My, Mz)

### 3. Member
- `member_id`: 부재 ID
- `member_type`: 부재 유형 (Beam, Column, Slab, Wall)
- `section_id`, `material_id`: 단면/재료 참조
- `start_node`, `end_node`: 시작/끝 노드

### 4. View
- `view_name`: 뷰 이름
- `view_type`: 뷰 유형 (3D, 2D, SectionView)
- `visibility`: 가시성 설정

## 실행 방법

1. MIDAS API 응답(JSON dict)을 입력으로 받는다
2. 위 4개 카테고리로 데이터를 추출/분류한다
3. 각 카테고리별 항목 수와 요약을 테이블로 출력한다
