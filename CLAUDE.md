# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MIDAS GEN NX API를 Python에서 사용하기 위한 래퍼 라이브러리. (주)동양구조 개발 중.
공식 `midas-gen` 라이브러리(v1.5.9)를 기반으로 하며, 서버 안전성을 위한 래퍼 계층을 유지한다.

## 개발 환경

**반드시 가상환경 사용:**
```bash
# 가상환경 활성화 (Windows)
.venv\Scripts\activate

# 가상환경 활성화 (bash/Git Bash)
source .venv/Scripts/activate
```

**예제 코드 실행:**
```bash
python test.py
```

**설치된 주요 패키지:** `midas-gen`, `requests`, `pandas`, `polars`, `colorama`

## 코드 아키텍처

```
MIDAS_API/
├── __init__.py       # 공개 API + midas-gen 기능 re-export (Result, TableOptions, Model 등)
├── _midas_api.py     # midas-gen MAPI_BASEURL/MAPI_KEY alias + 안전한 MidasAPI() 래퍼
├── _client.py        # MidasClient (ContextVar 기반, sys.exit 방지)
├── _to_excel.py      # JSON 응답 → DataFrame/행 변환 유틸리티
├── _section.py       # sectionDB — 단면 캐싱/info()
├── _element.py       # elementDB — 요소 캐싱/beam_section_map()
├── _beam_force.py    # beamForceDB — 설계 부재력 추출/피벗/최대값
├── _project.py       # projectDB (/db/PJCF)
├── _loads.py         # loadCaseDB, selfWeightDB, loadToMassDB
├── _floorload.py     # floorLoadDB (/db/FBLD)
└── _analysis.py      # structureTypeDB (/db/STYP)
```

### 핵심 패턴

**초기화 및 API 호출 패턴:**
```python
import MIDAS_API as MIDAS

MIDAS.MIDAS_API_BASEURL("https://...")   # → midas_gen.MAPI_BASEURL 위임
MIDAS.MIDAS_API_KEY("your-api-key")     # → midas_gen.MAPI_KEY 위임
response = MIDAS.MidasAPI("GET", "/db/STOR")  # MidasClient 경유 (안전)
```

- `MIDAS_API_BASEURL`/`MIDAS_API_KEY`는 `midas_gen.MAPI_BASEURL`/`MAPI_KEY`의 alias
- `MidasAPI()` 함수는 `MidasClient.request()`를 통해 호출 (midas-gen의 `sys.exit()` 방지)
- midas-gen 공식 기능도 직접 사용 가능: `MIDAS.Result.TABLE.BeamForce(...)`, `MIDAS.TableOptions(...)`

### API 응답 구조

MIDAS API는 중첩된 dict를 반환함. `_to_excel.py`의 유틸리티로 변환:
- `dict_to_rows(data, id_col="ID")` → list of dicts
- `to_dataframe(data, id_col="ID")` → pandas DataFrame
- midas-gen의 `Result.TABLE.*()` → polars DataFrame 직접 반환

## 웹 대시보드

### 백엔드 실행 (FastAPI, 포트 8000)
```powershell
cd backend; ../.venv/Scripts/uvicorn main:app --reload --port 8000
```

### 프론트엔드 실행 (Next.js, 포트 3000)
```powershell
cd frontend; npm run dev
```

### 구조
```
backend/          # FastAPI 서버
  main.py         # 앱 진입점, CORS, .env 로드
  routers/
    midas.py      # GET/POST/PUT/DELETE /api/midas/{path}
  requirements.txt

frontend/         # Next.js 앱
  app/
    layout.tsx    # 사이드바 포함 공통 레이아웃
    page.tsx      # 대시보드 (STOR 데이터, 차트, 테이블)
    explorer/
      page.tsx    # 엔드포인트 탐색기
  components/
    Sidebar.tsx   # 사이드바 네비게이션
    DataTable.tsx # TanStack Table 기반 정렬/필터 테이블
    ChartPanel.tsx# Recharts 막대차트 래퍼
    EndpointForm.tsx # API 호출 폼 (메서드/경로/Body)
```

### API 엔드포인트 (백엔드)
- `GET  /api/midas/{path}` → MIDAS API GET /db/{path}
- `POST /api/midas/{path}` → MIDAS API POST /db/{path}
- `PUT  /api/midas/{path}` → MIDAS API PUT /db/{path}
- `DELETE /api/midas/{path}` → MIDAS API DELETE /db/{path}
- `GET /health` → 서버 상태 확인
