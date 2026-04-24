# 운영 개선 백로그

사내 Electron 도구 기준에서 **지금은 보류, 조건 충족 시 승격**해야 할 항목을 기록한다.
각 항목은 "현재 보류 근거"와 "승격 트리거"를 함께 둔다.

## 1. bcrypt / argon2 패스워드 해싱 마이그레이션

- **현재 상태:** SHA-256 + salt 16bytes (`backend/auth_middleware.py:28-41`)
- **보류 근거:** 사내망 + Electron 단일 사용자 환경. brute-force 공격 표면이 거의 없다.
- **승격 트리거:** 
  - 사용자 10명 초과
  - 외부망(VPN 미경유) 노출
  - 보안 감사 요구
- **조치 시 건드릴 파일:**
  - `backend/auth_middleware.py` (`hash_password`, `verify_password`) — `passlib[bcrypt]` 또는 `argon2-cffi` 사용
  - `backend/requirements.txt` — 의존성 추가
  - 마이그레이션 전략: 로그인 시 옛 해시 감지 → 성공하면 새 해시로 re-hash

## 2. OS 키체인 (electron safeStorage) — MIDAS API Key 저장

- **현재 상태:** `midas_settings.json`에 평문 저장 (`%APPDATA%\midas-gen-nx-dashboard\`)
- **보류 근거:** 개인 PC 단일 사용자 기준 실효 위험 낮음. 파일은 OS 계정 홈 디렉토리 보호.
- **승격 트리거:**
  - 공유 PC 사용 시작
  - 다중 사용자 프로파일 환경
- **조치 시 건드릴 파일:**
  - `electron/main.js` — `safeStorage.encryptString()` / `decryptString()` 적용
  - `backend/routers/settings.py` — 저장 포맷을 암호문으로 바꾸거나 Electron에서 처리 후 런타임에만 백엔드로 전달
  - `MIDAS_API/_midas_api.py` — 키 주입 방식 일관성 유지

## 3. JWT_SECRET 환경변수 강제

- **현재 상태:** `backend/auth_middleware.py:20` fallback 문자열 `"midas-dashboard-secret-key-change-in-production"` 존재
- **보류 근거:** 현재 `.env`에 지정하지 않아도 앱이 뜨는 편의성. 사내망 한정이라 허용.
- **승격 트리거:**
  - 외부망 노출 (SSL 종료 리버스 프록시 뒤라도)
  - 보안 감사 요구
  - 여러 대 서버 배포로 공유 시크릿 필요
- **조치 시 건드릴 파일:**
  - `backend/auth_middleware.py:20` — fallback 제거, 없으면 `RuntimeError`
  - `backend/main.py` — 기동 시 `JWT_SECRET` 검증 로그 추가
  - `.env.example` — 기본값 제공

## 4. ESLint 부채 정리

- **현재 상태:** 다음 8개 위치에 inline `eslint-disable` 주석으로 baseline 0 유지 중:
  - `frontend/components/AuthGuard.tsx:43` — `react-hooks/set-state-in-effect`
  - `frontend/components/ConnectionStatus.tsx:27` — `react-hooks/set-state-in-effect`
  - `frontend/components/dashboard/MapSection.tsx` — Google Maps `any` 타입 6곳 (useRef 5개 + geocoder callback 1개)
- **보류 근거:** CI 게이트 도입 직후 baseline 빠르게 정리. 8개 모두 사내 도구 기능에 영향 없음.
- **승격 트리거:**
  - 동일 패턴이 3곳 이상 신규 추가될 때 (룰 자체 재검토)
  - Map 기능 확장 시
- **조치 시 건드릴 파일:**
  - `frontend/package.json` — `@types/google.maps` devDependency 추가
  - `frontend/components/dashboard/MapSection.tsx` — `any` → `google.maps.Map`/`Geocoder`/`Circle` 등으로 교체, disable 주석 제거
  - `frontend/components/AuthGuard.tsx`, `ConnectionStatus.tsx` — 초기 `setState` 호출을 `useState` 초기값으로 이전하거나 effect 패턴 재구성

## 5. CORS 화이트리스트 + 토큰 저장 위치 변경

- **현재 상태:** 
  - `backend/main.py:86-92` `allow_origins=["*"]`
  - `frontend/lib/auth.ts` — JWT를 `localStorage`에 저장
- **보류 근거:** Electron이 `file://` 또는 `localhost`에서 `127.0.0.1:8000`을 호출. 브라우저 외부 공격 노출 없음.
- **승격 트리거:**
  - 웹 모드 정식 지원 (Render 공개 URL 외부 접근)
  - 크로스 도메인 iframe 임베드 요구
- **조치 시 건드릴 파일:**
  - `backend/main.py` — `allow_origins`을 허용 origin 리스트로 한정
  - `frontend/lib/auth.ts` — httpOnly Cookie 기반 인증으로 전환 또는 in-memory 토큰 + refresh 패턴
  - `backend/routers/auth.py` — `Set-Cookie` 응답 지원

---

## 승격 결정 프로세스

1. 위 트리거 중 하나라도 발생하면 **해당 항목을 Top-priority로 전환**한다.
2. 승격 시 이 문서에서 제거하고, `CHANGELOG` 또는 별도 마이그레이션 노트로 이관한다.
3. 주기적 재검토: 최소 6개월마다 위 트리거 현실화 여부 확인.
