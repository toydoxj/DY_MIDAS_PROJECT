# MIDAS SSO 통합 인계 문서

> 작성: 2026-04-27
> 대상 작업자: DY_MIDAS_PROJECT를 직접 정리할 사람
> 관련 commit: `96c5d2f` (master)

## 1. 변경 배경

동양구조 업무관리(`task.dyce.kr` / `api.dyce.kr` — Vercel + Render + Supabase)와 사용자 풀을 통합한다.

- **인증/사용자 관리는 task 백엔드에서만** (가입·승인·역할 변경·비밀번호)
- MIDAS는 토큰 검증 + 사용자 정보 fetch만 함
- 같은 ID/비번 → 양쪽 로그인 가능

## 2. 이미 push된 변경 (`96c5d2f`)

| 파일 | 변경 |
|---|---|
| `backend/auth_middleware.py` | 자체 SHA-256 해싱 제거. JWT 검증만 + `https://api.dyce.kr/api/auth/me` 위임. `CurrentUser` dataclass로 user 객체 wrap (다른 라우터가 `user.midas_url` 등 attr 접근 그대로 호환) |
| `backend/routers/auth.py` | register/login/users 등 **모든 발급 엔드포인트 제거**. `/me`, `/me PUT`, `/status`만 thin proxy로 동양구조 백엔드에 forward |
| `backend/main.py` | `init_db()` 호출 제거 (자체 SQLite 안 씀) |
| `frontend/lib/auth.ts` | localStorage key `midas_*` → `dy_*` 통일. `register()` → `requestJoin()` (이메일 기반 직원 명부 자동 매칭) |
| `frontend/lib/types.ts` | `AUTH_URL` 기본값 `https://api.dyce.kr` |

## 3. 사용자 작업 — 진행해야 할 것

### A. **JWT_SECRET 통일** (가장 중요)

양쪽이 다르면 토큰 호환 안 됨 → 로그인 시 401.

1. **task 백엔드 측** Render Dashboard → `dy-task-backend` → Environment → `JWT_SECRET` 값 복사
2. MIDAS `.env.default` 또는 새 `.env`에 동일하게 등록:
   ```env
   JWT_SECRET=<복사한 값 그대로>
   ```
3. PyInstaller 빌드 시 이 `.env`를 datas로 번들 (이전 패턴: `.env.production` 형태도 OK)

### B. `.env` (또는 `.env.production`) 작성

`.env.default`를 복제하되 SSO 항목 추가:

```env
# 기존 MIDAS 키 (그대로 유지)
MIDAS_BASE_URL=https://moa-engineers.midasit.com:443/gen
MIDAS_API_KEY=...           # (서비스용 디폴트 키, 사용자별 키는 task에 저장)
GOOGLE_API_KEY=...

# SSO — 신규
JWT_SECRET=<task 백엔드와 동일>
AUTH_API_URL=https://api.dyce.kr

# Frontend 빌드 시 inline (프로세스 환경변수)
NEXT_PUBLIC_AUTH_URL=https://api.dyce.kr
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

### C. (선택) 더 이상 안 쓰는 파일 정리

다음 파일은 코드에서 import되지 않아 미사용:
- `backend/db.py`
- `backend/models/auth.py`

삭제하려면:
```bash
git rm backend/db.py backend/models/auth.py
git commit -m "정리: 자체 SQLite/User ORM 제거 (인증 SSO 위임)"
```

> ⚠️ `models/__init__.py`에서 auth를 import하면 같이 정리. 단순 삭제 후 `python -c "from main import app; print('OK')"` 로 import 검증.

### D. (선택) Frontend admin 페이지 정리

MIDAS의 `frontend/app/admin/` (사용자 승인/관리)도 더 이상 의미 없음. 두 가지 선택:

1. **삭제** + 사이드바 메뉴 제거. admin 작업이 필요하면 `https://task.dyce.kr/admin/users` 안내
2. **iframe 또는 link**로 task 관리 페이지 표시

권장: 1번 (단순 삭제) 후 README나 도움말에 안내.

### E. PyInstaller 빌드 + Electron 배포

기존 빌드 파이프라인 그대로:
1. `frontend/`에서 `npm run build` (정적 export)
2. `backend/`에서 PyInstaller spec으로 backend.exe 빌드 (`.env` datas 번들)
3. Electron으로 패키징 → 설치 파일 생성
4. 사용자에게 배포

## 4. 검증

### 로컬 dev (사용자 PC)
```bash
# 1. .env에 JWT_SECRET=<task와 동일> 설정
# 2. backend 띄우기
cd backend
../.venv/Scripts/uvicorn main:app --reload --port 8000

# 3. frontend 띄우기 (다른 터미널)
cd frontend
npm run dev

# 4. 검증
# - http://localhost:3000 로그인 화면 → task.dyce.kr 가입 정보로 로그인
# - 로그인 성공하면 토큰이 localStorage("dy_auth_token")에 저장됨
# - /api/auth/me 응답에 midas_url, has_midas_key, work_dir 포함되는지 확인
# - 설정 페이지에서 midas_url 변경 시 task의 PUT /api/auth/me로 forward됨
```

### 운영 (Electron 빌드 배포 후)
1. 동양구조에서 가입 (이메일이 직원 명부에 있으면 자동 승인)
2. MIDAS Electron 설치 → 같은 ID/비번 로그인
3. 정상 로그인 + 사용자 정보 표시 확인

## 5. 알려진 위험

| 위험 | 대응 |
|---|---|
| `JWT_SECRET` 양쪽 불일치 | 토큰 검증 실패 → 모든 사용자 401. 빌드 자동화 시 환경변수 동기화 점검 추가 권장 |
| `api.dyce.kr` 다운 시 MIDAS 로그인 불가 | 회사 네트워크 + Render 가용성에 의존. Render Starter 플랜 → 99.5%+ |
| 기존 MIDAS SQLite 사용자 | 마이그레이션 안 함. 다음 빌드 후 task에서 새로 가입 필요 (사내 안내) |
| `midas_key` 노출 위치 | task 백엔드의 `GET /api/auth/me/midas` (인증된 본인만 본인 키 가져감). MIDAS sidecar가 사용자별 MIDAS API 호출 시점에만 fetch |
| Electron CORS | 같은 sidecar(127.0.0.1:8000) 호출은 영향 없음. frontend가 `api.dyce.kr` 직접 호출은 origin이 file:///app:// → task 백엔드 CORSMiddleware는 `allow_origins=["*"]`이 아니므로 추가 필요 가능. 문제 발생 시 task 측 `CORS_ORIGINS`에 `null` 또는 Electron origin 추가 |

## 6. 동양구조 측 변경 (참고용, 이미 적용됨)

```
fbb55f2 auth: GET /me/midas endpoint (sidecar용 본인 MIDAS 자격 안전 노출)
3d7514d 보안: UserInfo 응답에서 midas_key 제외, has_midas_key boolean만 노출
d05a08a SSO 통합 준비 (A): users에 MIDAS 컬럼 추가
```

- `users` 테이블에 `midas_url`/`midas_key`/`work_dir` nullable 컬럼 추가
- `UserInfo` 응답에 `midas_url`/`has_midas_key`/`work_dir` 노출 (`midas_key`는 별도 endpoint)
- `PUT /api/auth/me`에서 위 항목 변경 가능
- `GET /api/auth/me/midas`로 본인 midas_key 안전 fetch

## 7. 질문/이슈가 있으면

- task 백엔드 측 작업 필요한 부분이 발견되면 issue 또는 본 문서에 추가
- API 스키마 차이 (예: 우리 응답에 추가 필드) → frontend types에 optional로 받으면 OK
