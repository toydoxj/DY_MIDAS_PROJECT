# DY_MIDAS_PROJECT — midas-gen 라이브러리 기반 개선 방향

> 작성: 정지훈 | (주)동양구조 | 2026. 04  
> 참조 라이브러리: `pip install midas-gen` · [공식 문서](https://midas-rnd.github.io/midasapi-python/)

---

## 1. 검토 배경

MIDASIT 공식 배포 `midas-gen` Python 라이브러리를 분석하여, DY_MIDAS_PROJECT의 현행 `MIDAS_API` wrapper 계층과의 차이를 식별하고 구체적인 개선 방향을 도출함.

---

## 2. midas-gen 라이브러리 구조

### 2.1 초기화 함수

| 함수 | 역할 | 비고 |
|---|---|---|
| `MAPI_KEY(key)` | API 인증 키 전역 설정 | GEN NX 앱과 동일 키 사용 |
| `MAPI_BASEURL(url)` | 서버 Base URL 수동 지정 | 로컬 환경 기본값 |
| `MAPI_BASEURL.autoURL()` | MAPI Key 기반 자동 서버 탐색 | 웹/Colab 환경 권장 |
| `MAPI_COUNTRY('KR')` | 레지스트리에서 Key/URL 자동 로드 | 한국 로컬 배포에 최적 |
| `MidasAPI(method, cmd, body)` | 저수준 REST 직접 호출 | GET/POST/PUT/DELETE |

### 2.2 모듈 계층 구조

| 계층 | 주요 클래스 / 메서드 |
|---|---|
| 모델 | `Node`, `Element`(1D/2D/3D), `Section`, `Material`, `Group` |
| 경계조건 | `Supports`, `ElasticLink`, `RigidLink`, `PointSpring`, `MLFC` |
| 하중 | `LoadCase`, `SelfWeight`, `NodalLoad`, `BeamLoad`, `FloorLoad`, `Temperature` |
| 시공단계 | `CS.Stage`, `CompositeSec`, `TimeLoads`, `CreepCoeff`, `Camber` |
| 해석제어 | `MainControl`, `PDelta`, `Buckling`, `EigenValue`, `Settlement` |
| 결과 | `Result.TABLE`, `Result.IMAGE`, `TableOptions` |

### 2.3 Result.TABLE — 핵심 결과 추출 API

`Result.TABLE`은 **Polars DataFrame**을 반환하는 고수준 결과 추출 인터페이스임.  
`keys` / `loadcase` / `cs_stage` 조합으로 필터링하며, `TableOptions`로 단위·포맷·Excel 출력을 제어함.

#### BeamForce 계열 메서드

| 메서드 | 용도 | 주요 파라미터 |
|---|---|---|
| `Result.TABLE.BeamForce()` | 표준 보 단면력 (Fx/Fy/Fz/Mx/My/Mz) | `keys`, `loadcase`, `parts` |
| `Result.TABLE.BeamForce_VBM()` | Envelope 기준 최대 단면력 | `items`, `parts`, `loadcase` |
| `Result.TABLE.BeamForce_StaticPrestress()` | PS 하중 단면력 | `keys`, `parts` |
| `Result.TABLE.BeamStress()` | 표준 보 응력 | `keys`, `loadcase`, `parts` |
| `Result.TABLE.BeamStress_7DOF()` | 7DOF 응력 (휨뒤틀림 포함) | `section_position` |
| `Result.TABLE.BeamStress_PSC()` | PSC 단면 응력 | `section_position` |

#### TableOptions 설정 클래스

| 파라미터 | 옵션값 | 설명 |
|---|---|---|
| `force_unit` | `KN` / `N` / `KGF` / `TONF` / `KIPS` | 단위계 설정 |
| `len_unit` | `M` / `CM` / `MM` / `FT` / `IN` | 길이 단위 |
| `num_format` | `Fixed` / `Scientific` / `General` | 숫자 표기 형식 |
| `decimal_place` | `0 ~ 15` | 소수점 자릿수 |
| `ExcelFileLoc` | 파일 경로 문자열 | Excel 자동 저장 경로 |
| `ExcelSheetName` | 시트명 문자열 | 저장 시트 지정 |
| `ExcelCellPos` | `"A1"` 또는 `"end"` | 셀 위치 (end = 이어쓰기) |

---

## 3. 현행 DY_MIDAS_PROJECT와의 비교

| 비교 항목 | midas-gen 라이브러리 | DY_MIDAS_PROJECT 현행 |
|---|---|---|
| 인터페이스 수준 | 고수준 객체 래퍼 | 저수준 REST 직접 호출 |
| 결과 반환 타입 | Polars DataFrame (즉시 사용) | `dict` → 자체 변환 처리 |
| API 인증 | `MAPI_KEY()` 전역 함수 | `ContextVar` 기반 `MidasClient` |
| Excel 출력 | `TableOptions` 내장 지원 | 별도 구현 필요 |
| 시공단계 지원 | `cs_stage` 파라미터 내장 | 미구현 |
| Envelope 결과 | `BeamForce_VBM()` 전용 메서드 | 수동 후처리 필요 |
| 의존성 | numpy, polars, scipy 등 | httpx, pydantic, polars 등 |
| 유지보수 | MIDASIT 공식 지원 | 자체 유지보수 |

---

## 4. 개선 방향

### [P1] midas-gen 라이브러리 채택 방향 결정

현행 `MIDAS_API` wrapper를 midas-gen으로 교체하거나 참조 설계로 활용하는 방향을 우선 결정해야 함.

- **교체 채택 시**: `MIDAS_API` wrapper 계층 제거, midas-gen 직접 의존, 코드량 대폭 감소
- **참조 설계 활용 시**: 기존 `ContextVar` `MidasClient` 구조 유지, `Result.TABLE` 패턴만 벤치마킹
- **권장**: 단기에는 참조 활용, 중기에는 Repository 패턴 전환 시점에 점진적 교체

---

### [P1] `beamForceDB` → `Result.TABLE` 대체

현행 `beamForceDB`는 클래스 수준 변경 가능 상태(mutable class-level state)로, 비동기 FastAPI 컨텍스트에서 race condition 위험이 식별된 바 있음.  
`Result.TABLE` 패턴으로 교체 시 이 문제를 근본적으로 해결할 수 있음.

**현행 문제 패턴**
```python
beamForceDB = {}  # 클래스 수준 — 요청 간 상태 공유 위험
```

**개선 목표 패턴**
```python
df = Result.TABLE.BeamForce(keys=elem_ids, loadcase=load_cases)
# Polars DataFrame — 요청별 독립 인스턴스, race condition 없음
```

---

### [P1] Polars 반환 타입 통일

midas-gen이 Polars를 기본 반환 타입으로 채택하고 있으므로, 결과 처리 파이프라인 전반을 Polars로 일원화함.

- 현행 혼용(`dict` + `polars`) → Polars DataFrame 단일화
- FastAPI 응답 직렬화: `df.to_dicts()` 또는 `df.write_json()` 활용
- Excel 출력: `df.write_excel()` 또는 `TableOptions.ExcelFileLoc` 활용

---

### [P2] `MAPI_COUNTRY('KR')` 기반 인증 자동화

로컬 Windows 배포 환경에서는 레지스트리에서 Key와 URL을 자동 로드할 수 있어 설정 오류를 방지할 수 있음.

```python
from midas_gen import *
MAPI_COUNTRY('KR')  # 레지스트리 자동 로드 — Key/URL 수동 입력 불필요
```

---

### [P2] `BeamForce_VBM`으로 Envelope 결과 추출 개선

현행 envelope 결과 추출은 수동 후처리에 의존하고 있음.  
`BeamForce_VBM()`은 `items` 파라미터로 축력/전단/모멘트를 선택하여 envelope 결과를 직접 추출하는 전용 메서드임.

```python
df_env = Result.TABLE.BeamForce_VBM(
    loadcase=["STLENV_STR(CB:max)"],
    items=["Axial", "Shear-y", "Moment-z"]
)
```

---

### [P2] 시공단계(`cs_stage`) 결과 추출 기능 추가

현행 DY_MIDAS_PROJECT에는 시공단계 결과 추출이 구현되어 있지 않음.  
`cs_stage` 파라미터로 단일 호출 일괄 추출이 가능함.

```python
df_cs = Result.TABLE.BeamForce(keys=elem_ids, cs_stage='all')
```

---

### [P3] `PlateForce` 연동으로 슬래브 결과 추출 확장

RC 슬래브 설계 자동화를 위해 `PlateForce` 계열 메서드 연동이 필요함.

- `PlateForce_UnitLength()`: 단위길이당 판력 (Fxx/Fyy/Mxx/Myy)
- `PlateForce_UnitLength_WA()`: Williame-Anderheggen 수정 모멘트
- `avg_nodal_result=True`: 절점 평균값으로 응력 스파이크 완화

---

## 5. 구현 우선순위 및 로드맵

| 우선순위 | 개선 항목 | 예상 공수 | 연계 기존 과제 |
|---|---|---|---|
| **P1** | midas-gen 채택 방향 결정 | 0.5일 | 아키텍처 로드맵 Phase 1 |
| **P1** | `beamForceDB` → `Result.TABLE` 대체 | 1~2일 | DB 상태 격리 (Repository 패턴) |
| **P1** | Polars 반환 타입 통일 | 0.5일 | 중복 HTTP 로직 제거 |
| **P2** | `MAPI_COUNTRY('KR')` 인증 자동화 | 0.5일 | Electron 배포 환경 설정 |
| **P2** | `BeamForce_VBM` Envelope 추출 | 1일 | RC 보 설계 엔진 연동 |
| **P2** | 시공단계(`cs_stage`) 결과 추출 | 1일 | Phase 3 기능 확장 |
| **P3** | `PlateForce` 슬래브 결과 연동 | 2일 | RC 슬래브 설계 엔진 |

---

## 6. 요약

| 구분 | 핵심 내용 |
|---|---|
| **즉시 적용** | `Result.TABLE` 패턴으로 `beamForceDB` race condition 해결, Polars 단일화 |
| **설계 참조** | `BeamForce_VBM` / `cs_stage` 파라미터 구조를 자체 API 설계에 반영 |
| **중기 교체 검토** | Repository 패턴 전환 시점에 midas-gen 교체 또는 의존성 추가 |
| **기능 확장** | `PlateForce` / 시공단계 결과는 midas-gen 활용으로 구현 공수 최소화 |

---

## 7. 진행 기록

### 2026-04-13: P1 — midas-gen 라이브러리 채택 완료

- `midas-gen` v1.5.9 설치 완료 (polars, scipy, numpy 의존성 포함)
- `_midas_api.py`: `MIDAS_API_BASEURL`/`MIDAS_API_KEY`를 `midas_gen.MAPI_BASEURL`/`MAPI_KEY` alias로 교체
- `__init__.py`: `Result`, `TableOptions`, `MAPI_COUNTRY`, `Section`, `Element`, `Node`, `Load`, `Material`, `Model` re-export 추가
- `MidasAPI()` 함수는 `MidasClient.request()` 경유 유지 (midas-gen의 `sys.exit()` 방지)
- `backend/dependencies.py` 삭제 (미사용)
- **채택 방향**: 참조 설계 활용 + 점진적 교체 (권장안 채택)
