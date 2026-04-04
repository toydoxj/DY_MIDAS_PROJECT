# MIDAS GEN NX API Dashboard

MIDAS GEN NX REST API를 Python에서 사용하기 위한 래퍼 라이브러리 및 웹 대시보드.

**(주)동양구조** | 정지훈 (건축구조기술사)

## 프로젝트 구조

```
Task_MIDAS/
├── MIDAS_API/                  # Python API 래퍼 라이브러리 (도메인별 구성)
│   ├── _midas_api.py           # REST API 클라이언트 (핵심)
│   ├── _project.py             # 프로젝트 DB (PJCF)
│   ├── _loads.py               # 하중 DB (STLD, BODF, LTOM)
│   ├── _analysis.py            # 해석 설정 DB (STYP)
│   ├── _beam_force.py          # 보 설계 부재력 추출/피벗/Excel
│   └── _to_excel.py            # JSON → DataFrame 변환
│
├── backend/                    # FastAPI 백엔드
│   ├── main.py
│   ├── engines/
│   │   └── kds_rc_beam.py      # KDS 41 30 00 RC보 설계 검토 엔진
│   ├── models/                 # Pydantic 데이터 모델
│   └── routers/                # midas, project, settings, loadcase, analysis, member
│
├── frontend/                   # Next.js 프론트엔드
│   ├── app/
│   │   ├── page.tsx            # 대시보드
│   │   ├── loadcase/           # 하중정보 (Static, Floor, Seismic)
│   │   ├── member-check/       # 부재검토
│   │   │   └── rc-beam/        # RC보 설계 검토
│   │   │       ├── page.tsx    # 통합 테이블 (부재력+배근+DCR)
│   │   │       ├── _components/# MaterialInput, RebarInputTable, DesignResult
│   │   │       └── _lib/       # 타입, 철근규격 상수
│   │   ├── explorer/           # API 탐색기
│   │   └── settings/           # 설정
│   ├── components/
│   │   ├── ui/                 # 공통 UI (Button, Select, SectionCard 등)
│   │   └── dashboard/          # 대시보드 섹션 컴포넌트
│   └── lib/                    # 공통 타입, 유틸
│
├── .claude/
│   ├── agents/                 # AI 에이전트 정의
│   │   └── beam-design-reviewer.md  # RC보 설계 검토 전문 에이전트
│   └── skills/                 # 스킬 (규칙/참조 데이터)
│       ├── seismic.md          # 지진하중 검토 규칙 (KDS 41 17 00)
│       └── member-naming.md    # 부재명 명명 규칙
│
├── electron/                   # Electron 데스크톱 앱 패키징
├── test_beam_force.py          # 보 부재력 추출 테스트 스크립트
└── .env                        # API URL/KEY 설정
```

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
- API 설정, 자중입력 확인, 풍속 등치선 지도, 층 설정 조회

### 지진하중 (Seismic Load)
- 등가정적 지진하중 검토 (X/Y 방향 독립)
  - 지반분류 자동판정, 근사고유주기, 적용주기, Cs, 밑면전단력
  - 응답스펙트럼 밑면전단력 및 Scale-up Factor (Cm)
- Design Spectrum 검증 (Fa, Fv, Sds, Sd1, Site Class, Ie, R)
- 고유치 해석 (Eigenvalue Analysis) + 타임스탬프/캐시
- Story Shear (Response Spectrum)

### RC보 설계 검토 (Beam Design Check)
- STOR 기반 층 선택 → RC 보/거더 필터링 (네이밍 규칙 기반)
- 통합 테이블: 부재력 + 배근 입력 + DCR 실시간 표시
  - My(-) → 상부근(n-Dxx) → 상부DCR
  - My(+) → 하부근(n-Dxx) → 하부DCR
  - Fz → 스터럽(n-Dxx@s) → 전단DCR
- KDS 41 30 00 기준: 휨강도, 전단강도, 철근비, 스터럽 간격 검토
- 배근/재료 변경 시 자동 검토 (300ms 디바운스)

### 하중정보
- Static Load Case / Floor Load / Seismic Load
- Wind Load, Earth Pressure (예정)

### 기타
- 탐색기: MIDAS API 엔드포인트 직접 테스트
- 부재별 정리 / 전체 데이터 뷰

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

## 라이선스

MIT License
