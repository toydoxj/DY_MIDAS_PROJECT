# MIDAS GEN NX API Dashboard

MIDAS GEN NX REST API를 Python에서 사용하기 위한 래퍼 라이브러리 및 웹 대시보드.

**(주)동양구조** | 정지훈 (건축구조기술사)

## 프로젝트 구조

```
Task_MIDAS/
├── MIDAS_API/                  # Python API 래퍼 라이브러리 (midas-gen 기반)
│   ├── _midas_api.py           # midas-gen MAPI_BASEURL/KEY alias + 안전한 MidasAPI 래퍼
│   ├── _client.py              # MidasClient (ContextVar, sys.exit 방지)
│   ├── _beam_force.py          # 설계 부재력 누적 캐싱/피벗/최대값
│   ├── _section.py / _element.py # 단면·요소 캐싱 + JOIN
│   ├── _project.py / _loads.py / _analysis.py / _floorload.py  # 도메인별 DB
│   └── _to_excel.py            # JSON → DataFrame 변환
│
├── backend/                    # FastAPI 백엔드
│   ├── main.py
│   ├── auth_middleware.py       # 토큰 검증/사용자 정보 모두 api.dyce.kr 위임 (secret 불필요)
│   ├── access_log.py            # 본 앱 자체 access log (SQLite, BACKEND_DATA_DIR)
│   ├── exceptions.py            # MidasError 예외 계층
│   ├── work_dir.py              # 작업 디렉토리 관리
│   ├── engines/
│   │   ├── kds_rc_beam.py      # KDS 41 30 00 RC보 설계 검토 엔진
│   │   └── seismic_cert_hwpx.py # 내진확인서 hwpx 생성 엔진
│   ├── models/                 # Pydantic 데이터 모델
│   │   ├── common.py, project.py, settings.py
│   │   ├── loadcase.py, floorload.py, analysis.py
│   │   ├── member.py, seismic_cert.py
│   │   ├── slab_span.py         # 슬래브 경간/패널/하중/배근 분석
│   │   ├── load_map.py          # 층별 Load Map 시각화 응답
│   │   └── project_settings.py  # 그리드/축렬 설정 (자동 탐지)
│   ├── engines/
│   │   ├── kds_rc_beam.py      # RC보 KDS 설계 검토
│   │   └── slab_span.py         # 슬래브 패널 탐색(face/OMBB) + 회전 그리드 + Floor Load 매칭
│   └── routers/                # auth(thin proxy → api.dyce.kr), admin(access log),
│                                # settings, project, loadcase, analysis, floorload, member,
│                                # slab_span, load_map, project_settings, seismic_cert, midas
│
├── frontend/                   # Next.js 프론트엔드
│   ├── app/
│   │   ├── page.tsx            # 대시보드
│   │   ├── project-settings/   # 프로젝트 설정 (그리드 축렬, 회전 그룹, 기준점)
│   │   ├── loadcase/           # 하중정보 (Static, Floor, Seismic)
│   │   │   └── load-map/       # 층별 Load Map (FBLA 다각형 + Wu=1.2D+1.6L)
│   │   ├── member-check/       # 부재검토
│   │   │   ├── rc-beam/        # RC보 설계 검토
│   │   │   │   ├── page.tsx    # 통합 테이블 (부재력+배근+DCR)
│   │   │   │   ├── _components/# MaterialInput, RebarInputTable, DesignResult
│   │   │   │   └── _lib/       # 타입, 철근규격 상수
│   │   │   └── slab-span/      # 슬래브 경간/하중/배근 자동 분석
│   │   │       ├── page.tsx    # 평면 SVG + 분류(S) 테이블 + 배근표
│   │   │       ├── _components/# SlabPlanView, SlabSectionsTable
│   │   │       └── _lib/       # Panel/LevelReport/SlabSection 타입
│   │   ├── documents/           # 문서 작성
│   │   │   └── seismic-cert/   # 내진설계 확인서 자동 생성
│   │   ├── explorer/           # API 탐색기
│   │   └── settings/           # 설정
│   ├── components/
│   │   ├── ui/                 # 공통 UI (Button, Select, SectionCard 등)
│   │   ├── GridAxesOverlay.tsx # 축렬 SVG 오버레이 (Slab/LoadMap 공용)
│   │   └── dashboard/          # 대시보드 섹션 컴포넌트
│   └── lib/                    # 공통 타입, 유틸
│
├── .claude/                       # AI 자산 (Hybrid 분류축: 역할 × 도메인)
│   ├── registry.yaml              # 자산 인덱스 (id/type/path/status/owner/depends_on)
│   ├── agents/
│   │   ├── reviewers/             # 검토 에이전트 (도메인별)
│   │   │   ├── rc-beam.md         # RC 보 — KDS 14 20 / 17 10 (frontmatter name=beam-design-reviewer)
│   │   │   └── rc-slab.md         # RC 슬래브 — KDS 14 20 30/50/70/22
│   │   ├── authors/               # 산출물 작성 에이전트
│   │   │   ├── seismic-cert.md    # 내진확인서 hwpx 자동 작성
│   │   │   └── design-report.md   # PDF/DXF/Excel 보고서·도면
│   │   └── _shared/               # 공통 매뉴얼 (보일러플레이트 추출)
│   │       ├── agent-memory-howto.md
│   │       └── output-contract.md
│   ├── skills/
│   │   ├── domains/               # KDS 도메인 지식
│   │   │   ├── kds-rc-slab.md
│   │   │   └── kds-seismic-load.md  # KDS 41 17 00:2022
│   │   ├── midas-api/             # MIDAS REST API 레퍼런스
│   │   │   ├── index.md           # 5 카테고리 인덱스
│   │   │   ├── db-{node,elem,sect,stld,stor,fbla}.md  # 자주 쓰는 6개
│   │   │   └── schema-eigenvalue.md
│   │   └── conventions/
│   │       └── member-naming.md
│   ├── rules/
│   │   └── kds_code.md            # backend/engines/**/*.py 작성 규칙
│   ├── commands/
│   │   └── midas-pipeline/        # /midas-pipeline:<name> 슬래시 커맨드
│   │       ├── validate-config.md → convert-api.md → run-workflow.md
│   │       └── sort-data.md → export-results.md
│   └── agent-memory/              # 에이전트별 영속 메모리
│
├── docs/api_specs/                # MCP 도구 명세 JSON (참조용, 실제 MCP 서버 아님)
├── scripts/
│   └── claude_assets_lint.py     # registry.yaml + frontmatter 검증
│
├── electron/                      # Electron 데스크톱 앱 패키징
├── test_beam_force.py             # 보 부재력 추출 테스트 스크립트
└── .env                           # API URL/KEY 설정
```

### .claude/ 자산 검증

```bash
.venv/Scripts/python scripts/claude_assets_lint.py
```

종료 코드 0 = 모든 자산의 frontmatter 표준(name/description/status/last_reviewed/owner) + registry.yaml path 실재 + depends_on 참조 정합성 통과.

## 빠른 시작

### API 래퍼 사용

```python
import MIDAS_API as MIDAS

MIDAS.MIDAS_API_BASEURL("https://moa-engineers.midasit.com:443/gen")
MIDAS.MIDAS_API_KEY("your-api-key")
response = MIDAS.MidasAPI("GET", "/db/STOR")
df = MIDAS.to_dataframe(response, id_col="KEY")
```

### Electron 앱 실행

```bash
cd electron && npm start
```

### 개발 모드 (백엔드 + 프론트엔드)

```bash
# 백엔드 (포트 8000)
cd backend && ../.venv/Scripts/uvicorn main:app --reload --port 8000

# 프론트엔드 (포트 3000)
cd frontend && npm run dev
```

## 주요 기능

### 대시보드
- 프로젝트 정보 (중요도, 전단파속도, 기반암깊이, 구조물형식/지진력저항시스템 X/Y)
- 재료 강도 (콘크리트 층별, 철근 지름별, 강재)
- API 설정, 자중입력 확인, 풍속 등치선 지도, 층 설정 조회
- 다크/라이트 모드 전환 (shadcn/ui)

### 지진하중 (Seismic Load)
- 등가정적 지진하중 검토 (X/Y 방향 독립)
  - 지반분류 자동판정, 근사고유주기, 적용주기, Cs, 밑면전단력
  - 응답스펙트럼 밑면전단력 및 Scale-up Factor (Cm)
- Design Spectrum 검증 (Fa, Fv, Sds, Sd1, Site Class, Ie, R)
- 고유치 해석 (Eigenvalue Analysis) + 타임스탬프/캐시
- Story Shear (Response Spectrum)

### RC보 설계 검토 (Beam Design Check)
- STOR 기반 층 선택 → RC 보/거더 필터링 (네이밍 규칙 기반, 정렬: 층→B→G→번호)
- 배근 형식: ALL / BOTH / 3단 (연속단/중앙/불연속단)
- 통합 테이블: 부재력 + 배근 입력 + DCR 실시간 표시
  - My(-) → 상부근(n-Dxx) → 상부DCR
  - My(+) → 하부근(n-Dxx) → 하부DCR
  - Fz → 스터럽(n-Dxx@s) → 전단DCR
- KDS 41 30 00 기준: 휨강도, 전단강도, 철근비, 스터럽 간격 검토
- 배근/재료 변경 시 자동 검토 (300ms 디바운스)
- 대시보드 재료 강도 연동 (주근 지름별 fy 자동 매칭)
- 배근 데이터 영구 저장 (JSON 파일 + localStorage 자동 임시 저장)

### 문서 작성 (Documents)
- 구조안전 및 내진설계 확인서 자동 생성 (별지 제1호/제2호서식)
  - MIDAS 데이터 자동 수집 (프로젝트, SPFC, STOR, 밑면전단력, 고유주기)
  - SFRS 자동 매핑 (KDS 41 17 00:2022 표 6.2-1)
  - 내진설계범주(Sds 기반), 허용층간변위(중요도 기반) 자동 계산
  - 모드 해석 상위 3개 모드 자동 수집
  - hwpx 양식에 데이터 삽입 후 다운로드
  - 지상층수 기반 양식 자동 선택 (5층이하/6층이상)

### 하중정보
- Static Load Case / Floor Load / Seismic Load
- **Load Map**: 층별 평면 + FBLA 다각형 시각화
  - 다각형별 DL/LL/Wu(1.2D+1.6L) 자동 계산 + 다중 하중 popover
  - 등간격 inset 슬라이더(50/100/200/300mm), 휠 줌·팬, 하중명 라벨/색상
  - **PDF 출력**: 현재 zoom/pan 그대로 A3 가로 + 흰 배경 + 15mm 보더 (jsPDF + html-to-image)
  - **DXF 출력**: FBLA 영역 + 솔리드 해치(50% 투명) + fbld 별 컬러 레이어 + 한글 텍스트, mm 고정, shrink 슬라이더 반영 (ezdxf)
- Wind Load, Earth Pressure (예정)

### 슬래브 경간/하중/배근 자동 분석 (`/member-check/slab-span`)
- 평면 그래프 face detection + OMBB 로 비사각형/회전 패널 인식
- 사선 보(SKEW) merge + polyline chain 으로 끊김 없는 평면 시각화
- 분류(S) 단위 두께/TYPE(A~E)/X1~X5/Y1~Y5 배근 저장(JSON)
- 스냅샷 save/load — 분석 + 패널명 + 분류 + 배근 통합 보관
- "모델 다시 읽기" 버튼: MIDAS 파일 변경 시 노드/요소 캐시 초기화

### 프로젝트 설정 (`/project-settings`)
- 그리드 축렬 자동 탐지 — 길이 가중 히스토그램 + 직교쌍 + 적응 클러스터링
- X/Y 축렬 + 임의 회전 그룹(extra_groups) 추가, 음수 offset, mm 통일
- 라벨 포맷(prefix `X1/Y1` vs simple `1/A`), 기준점(origin) mm 입력
- `GridAxesOverlay` 로 Slab Span/Load Map 양쪽에 오버레이

### 기타
- 탐색기: MIDAS API 엔드포인트 직접 테스트
- 부재별 정리 / 전체 데이터 뷰
- [ROADMAP.md](./ROADMAP.md) — 페이즈 기반 기능 로드맵

## 환경 설정

```bash
# 가상환경 활성화
source .venv/Scripts/activate   # Git Bash
.venv\Scripts\activate          # Windows CMD

# .env 파일
MIDAS_BASE_URL=https://moa-engineers.midasit.com:443/gen
MIDAS_API_KEY=your-api-key
GOOGLE_API_KEY=your-google-maps-api-key
```

## Electron 데스크톱 앱 빌드

```bash
# 1. Frontend 정적 빌드
cd frontend && npm run build

# 2. Backend PyInstaller 번들
cd backend && ../.venv/Scripts/pyinstaller backend.spec --noconfirm

# 3. Electron 설치파일
cd electron && npm run build
```

산출물: `electron/dist/MIDAS Dashboard Setup X.Y.Z.exe`
GitHub Release 업로드 시에는 공백을 하이픈으로 변경: `MIDAS-Dashboard-Setup-X.Y.Z.exe`

**번들 슬림화 (중요)**: `backend.spec`의 `excludes`는 `polars/scipy/gmsh/PIL`을 제거해 번들 크기를 절반 가까이 줄인다 (203 MB → 118 MB). `midas-gen` pip 의존성에 있으나 실제로는 사용되지 않는 패키지들이다.

## 배포 (Render)

루트의 `render.yaml` Blueprint로 관리한다.

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check: `/health`
- Python 버전: `.python-version` + `runtime.txt` (3.12.7)
- `backend/requirements.txt`에 `midas-gen` 포함 필수

기존 Dashboard 서비스 사용 시에도 Start Command는 위와 동일하게 한 줄로 설정한다.

## 관련 문서

- [BACKLOG.md](./BACKLOG.md) — 보류 중인 운영/보안 개선 항목과 승격 트리거
- [ROADMAP.md](./ROADMAP.md) — 슬래브/Load Map/그리드 자동 탐지 등 페이즈 기반 로드맵

## 라이선스

Proprietary — (주)동양구조
