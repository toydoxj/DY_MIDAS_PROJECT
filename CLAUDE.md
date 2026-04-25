# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MIDAS GEN NX API를 Python에서 사용하기 위한 래퍼 라이브러리와 대시보드 프로젝트다.
공식 `midas-gen` 라이브러리를 참조하며, 서버 안전성을 위해 프로젝트 래퍼 계층을 함께 유지한다.

## 개발 환경

### 반드시 가상환경 사용

```bash
# 가상환경 활성화 (Windows)
.venv\Scripts\activate

# 가상환경 활성화 (bash/Git Bash)
source .venv/Scripts/activate
```

### 예제 코드 실행

```bash
python test.py
```

설치된 주요 패키지: `midas-gen`, `requests`, `pandas`, `polars`, `colorama`, `fastapi`, `uvicorn`, `sqlalchemy`, `python-jose`, `python-dotenv`, `openpyxl`

## 코드 아키텍처

```text
MIDAS_API/
├── __init__.py        # 공개 API + midas-gen 기능 re-export
├── _midas_api.py      # 안전한 MidasAPI() 래퍼 (BASEURL/KEY alias)
├── _client.py         # ContextVar 기반 HTTP 클라이언트
├── _to_excel.py       # JSON 응답 -> DataFrame/행 변환 유틸리티
├── _project.py        # projectDB (프로젝트 정보)
├── _loads.py          # loadCaseDB, selfWeightDB, loadToMassDB
├── _analysis.py       # structureTypeDB
├── _floorload.py      # floorLoadDB
├── _section.py        # sectionDB (단면 캐싱)
├── _element.py        # elementDB (요소 캐싱)
└── _beam_force.py     # beamForceDB (설계 부재력 누적 캐싱/피벗)
```

### 핵심 패턴

#### 초기화 및 API 호출 패턴

```python
import MIDAS_API as MIDAS

MIDAS.MIDAS_API_BASEURL("https://...")
MIDAS.MIDAS_API_KEY("your-api-key")
response = MIDAS.MidasAPI("GET", "/db/STOR")
```

- `MIDAS_API_BASEURL`/`MIDAS_API_KEY`는 `midas_gen` 설정과 연동된다.
- `MidasAPI()`는 ContextVar 기반 클라이언트를 통해 요청별 상태를 분리한다.
- `_to_excel.py`의 `dict_to_rows()`, `to_dataframe()`은 중첩 dict 응답을 평탄화한다.

### API 응답 구조

- `dict_to_rows(data, id_col="ID")` -> list of dict
- `to_dataframe(data, id_col="ID")` -> pandas DataFrame

## 문서 진입 순서

1. 전체 가이드: `CLAUDE.md`
2. 자동화 명령 체계: `.claude/commands/midas-pipeline/*.md` (validate-config → convert-api → run-workflow → sort-data → export-results)
3. 도메인/규칙 스킬:
   - 도메인 지식: `.claude/skills/domains/*.md` (지진하중 등)
   - MIDAS API 레퍼런스: `.claude/skills/midas-api/*.md` (index 허브 + 엔드포인트별)
   - 명명 규약: `.claude/skills/conventions/*.md` (부재명 등)
4. 프로젝트 룰: `.claude/rules/*.md` (예: `kds_code.md`)
5. AI 에이전트 정의:
   - 검토 에이전트: `.claude/agents/reviewers/*.md` (RC보 등)
   - 산출물 작성 에이전트: `.claude/agents/authors/*.md` (내진확인서/도면보고서 등)
   - 공통 매뉴얼: `.claude/agents/_shared/*.md` (메모리 사용법, 출력 계약)
6. 자산 인덱스/거버넌스: `.claude/registry.yaml` + `scripts/claude_assets_lint.py`
7. MCP 도구 명세 (참조용): `docs/api_specs/*.json`
8. 프론트엔드 작업 시 추가 규칙: `frontend/AGENTS.md`
9. 자산 재구성 노트: `.claude/RESTRUCTURE_NOTES.md`

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

```text
backend/                  # FastAPI 서버
  main.py                 # 앱 진입점, CORS, .env 로드
  db.py                   # SQLAlchemy 엔진/세션 초기화
  auth_middleware.py       # JWT 인증 미들웨어
  exceptions.py            # MidasError 예외 계층
  work_dir.py              # 작업 디렉토리 관리
  routers/
    auth.py               # 회원가입/로그인/사용자 관리
    settings.py            # API URL/KEY 설정
    project.py             # 프로젝트 정보 조회/동기화
    loadcase.py            # 하중케이스 조회/동기화
    analysis.py            # 자중/질량/구조형식
    floorload.py           # 바닥하중 관리
    member.py              # 부재 검토 (RC보 설계)
    seismic_cert.py        # 내진확인서 hwpx 생성
    midas.py               # 와일드카드 프록시 (반드시 마지막 등록)
  models/                  # Pydantic 데이터 모델
    auth.py, common.py, project.py, settings.py,
    loadcase.py, floorload.py, analysis.py,
    member.py, seismic_cert.py
  engines/
    kds_rc_beam.py         # KDS 41 30 00 RC보 설계 검토
    seismic_cert_hwpx.py   # 내진확인서 hwpx 생성

frontend/                 # Next.js 앱
  app/
    layout.tsx             # AppShell 포함 공통 레이아웃
    page.tsx               # 대시보드 (프로젝트/재료/설정 종합)
    login/                 # 로그인
    admin/                 # 관리자 (사용자 승인/관리)
    settings/              # API 설정
    project/               # 프로젝트 정보
    explorer/              # API 엔드포인트 탐색기
    loadcase/              # 하중정보 (Static, Floor, Seismic)
    member-check/rc-beam/  # RC보 설계 검토
    documents/seismic-cert/# 내진설계 확인서
    changelog/             # 버전 기록
  components/
    AppShell.tsx, AuthGuard.tsx, Sidebar.tsx,
    ConnectionStatus.tsx, DataTable.tsx, ChartPanel.tsx,
    EndpointForm.tsx
    dashboard/             # 대시보드 섹션 컴포넌트
    ui/                    # 공통 UI (Button, Select, SectionCard 등)
  lib/                     # 공통 타입, 유틸, API 헬퍼
```

### API 엔드포인트 (백엔드)

- `POST /api/auth/register`, `/login`, `/me` — 인증
- `GET/PUT /api/settings` — API URL/KEY 설정
- `GET /api/project/info` — 프로젝트 정보
- `GET /api/loadcase/list`, `POST /api/loadcase/sync` — 하중케이스
- `GET /api/analysis/self-weight`, `/structure-mass`, `/load-to-mass` — 해석
- `GET/POST /api/floorload/*` — 바닥하중 CRUD
- `GET /api/member/sections`, `POST /api/member/rc-beam/check` — 부재 검토
- `POST /api/seismic-cert/generate` — 내진확인서 hwpx 생성
- `GET/POST/PUT/DELETE /api/midas/{path}` — 와일드카드 프록시
- `GET /health` — 서버 상태 확인
