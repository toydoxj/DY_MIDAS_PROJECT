# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MIDAS GEN NX API를 Python에서 사용하기 위한 래퍼 라이브러리. (주)동양구조 개발 중

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

**설치된 주요 패키지:** `requests`, `pandas`, `colorama`

## 코드 아키텍처

```
MIDAS_API/
├── __init__.py       # 공개 API 노출: MIDAS_API_BASEURL, MIDAS_API_KEY, MidasAPI
├── _midas_api.py     # API 클라이언트 구현 (핵심 모듈)
└── _to_excel.py      # JSON 응답 → DataFrame/행 변환 유틸리티
```

### 핵심 패턴

**초기화 및 API 호출 패턴:**
```python
import MIDAS_API as MIDAS

MIDAS.MIDAS_API_BASEURL("https://...")   # 클래스 변수에 URL 저장
MIDAS.MIDAS_API_KEY("your-api-key")     # 클래스 변수에 키 저장
response = MIDAS.MidasAPI("GET", "/db/STOR")  # REST 호출
```

- `MIDAS_API_BASEURL`과 `MIDAS_API_KEY`는 **클래스 변수**를 사용하므로 전역 상태로 관리됨
- `MidasAPI()` 함수는 POST/GET/PUT/DELETE 메서드 지원, JSON dict 반환
- `_to_excel.py`의 `dict_to_rows()`, `to_dataframe()`은 중첩 dict 응답을 평탄화

### API 응답 구조

MIDAS API는 중첩된 dict를 반환함. `_to_excel.py`의 유틸리티로 변환:
- `dict_to_rows(data, id_col="ID")` → list of dicts
- `to_dataframe(data, id_col="ID")` → pandas DataFrame

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
