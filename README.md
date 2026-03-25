# MIDAS GEN NX API Dashboard

MIDAS GEN NX REST API를 Python에서 사용하기 위한 래퍼 라이브러리 및 웹 대시보드.

**(주)동양구조** | 정지훈 (건축구조기술사)

## 프로젝트 구조

```
Task_MIDAS/
├── MIDAS_API/                  # Python API 래퍼 라이브러리
│   ├── _midas_api.py           # REST API 클라이언트 (핵심)
│   ├── _projectDB.py           # 프로젝트 DB 클래스
│   ├── _staticloads.py         # Static Load Case / Self-Weight DB 클래스
│   └── _to_excel.py            # JSON → DataFrame 변환
│
├── backend/                    # FastAPI 백엔드
│   ├── main.py
│   └── routers/                # midas, project, settings, loadcase 라우터
│
├── frontend/                   # Next.js 프론트엔드
│   ├── app/                    # 대시보드, 하중정보, 탐색기, 프로젝트, 설정
│   └── components/             # Sidebar, DataTable, ChartPanel 등
│
├── electron/                   # Electron 데스크톱 앱 패키징
├── config/templates/           # MIDAS 모델 템플릿 (YAML)
├── agent_midas_orchestrator.py # AI 자동화 에이전트
├── test.py                     # API 테스트 스크립트
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

- **대시보드**: 프로젝트 정보, API 설정, 자중입력 확인, 풍속 등치선 지도, 층 설정 조회
- **하중정보**: Static Load Case 편집 (추가/수정/삭제 → MIDAS 동기화)
- **탐색기**: MIDAS API 엔드포인트 직접 테스트

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
