MIDAS API 자동화 8단계 워크플로우를 실행한다.

## 8단계 워크플로우

1. **Config Load** - config.yaml 또는 지정 파일을 읽는다
2. **Validation** - /validate-config 로직으로 검증한다
3. **DY_Form Creation** - 6개 항목(geometry, section, material, load, boundary, view) 확인
4. **API Conversion** - /convert-api 로직으로 MIDAS API 포맷 변환
5. **MIDAS Communication** - MIDAS_API 래퍼를 사용하여 실제 API 호출
   - ModelingInfo, LoadCase, Section, Material 순서로 설정
   - 해석 실행
6. **Data Sorting** - API 응답을 4개 모델로 분류 (ModelingInfo, LoadCase, Member, View)
7. **Model Generation** - 분류된 데이터를 구조화
8. **Export Results** - results/ 폴더에 JSON으로 내보내기

## 실행 방법

1. `agent_midas_orchestrator.py`를 가상환경에서 실행한다
2. 각 단계의 진행 상황을 출력한다
3. 오류 발생 시 해당 단계에서 중단하고 원인을 보고한다
4. 완료 시 results/results.json 경로와 요약을 출력한다

## 필수 조건
- .env 파일에 MIDAS_BASE_URL, MIDAS_API_KEY 설정
- MIDAS GEN NX가 실행 중이어야 함
- 가상환경 활성화 상태
