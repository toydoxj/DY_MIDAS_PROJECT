"use client";

import { useState, useEffect } from "react";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.3",
    date: "2026-05-04",
    changes: [
      "대시보드 진입 직후 로그인 화면으로 튕기는 문제 수정 — 진짜 원인 (v1.4.1/v1.4.2 조치는 별개의 SSO 분리 작업)",
      "근본 원인: MIDAS GEN 'client does not exist' 응답(401)을 sidecar 가 그대로 frontend 에 forward → authFetch 가 SSO 만료로 오해해 무차별 logout",
      "수정: MidasAuthExpiredError 의 HTTP status 를 401 → 502(Bad Gateway) 로 변경. error_code 'AUTH_EXPIRED' 와 안내 메시지는 유지 — 사용자에게는 'MIDAS GEN 세션을 찾지 못했습니다…' 메시지가 그대로 노출",
    ],
  },
  {
    version: "1.4.2",
    date: "2026-05-04",
    changes: [
      "자동 로그인 — 앱 시작 시 NAVER WORKS 세션이 살아있으면 사용자 클릭 없이 자동 로그인 (silent SSO, 7초 timeout)",
      "토큰 보안 강화 — JWT/사용자 정보를 OS 보호 영역(Windows DPAPI / macOS Keychain)에 암호화 저장 (Electron safeStorage). 평문 localStorage 노출 제거",
      "로그아웃 후 같은 창 세션 동안은 silent 자동 시도 차단 (NAVER 세션이 살아있어도 즉시 재로그인 안 됨)",
    ],
  },
  {
    version: "1.4.1",
    date: "2026-05-04",
    changes: [
      "로그인 후 대시보드 진입 직후 다시 로그인 화면으로 튕기는 문제 수정",
      "task.dyce.kr 와 동시에 활성 세션 유지 — SSO 요청 시 client=dy-midas 전송으로 (user_id, client) 단위 세션 분리",
      "task 백엔드(api.dyce.kr)에 user_sessions 테이블 신설 + cli claim 도입 필요 (Task_DY q6o7p8q90504)",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-04-30",
    changes: [
      "Static Load Case 프리셋 불러오기 — Type 1~4 (기본 / 등가정적법 / 지하내진포함 / 경량쉘터) 한 번에 적용",
      "기존 케이스가 있으면 교체 확인 dialog 후 진행, 없으면 즉시 적용",
      "프리셋 정의: docs/Setting_Static_Load_Case.md 참조",
      "TYPE_MAP 확장: LR(Roof Live), ES(Earthquake Static) 추가",
    ],
  },
  {
    version: "1.3.4",
    date: "2026-04-29",
    changes: [
      "패널존 효과 활성 판정 정정: 0=비활성, 0초과 1.0이하=활성 (이전 버전 반대)",
      "offs_factor 응답 키 변형 자동 매칭(대소문자 무시 폴백) — 입력 박스에 값이 안 보이던 문제 해결",
      "원본 보기 토글 추가 — 응답 JSON을 직접 확인 가능",
    ],
  },
  {
    version: "1.3.3",
    date: "2026-04-29",
    changes: [
      "패널존 효과를 API 설정 카드 내부로 통합 (별도 카드 제거)",
      "offs_factor 값 직접 편집 + 적용(PUT) 가능 — 활성은 0=ON, 0초과 1.0이하=OFF로 자동 판정",
    ],
  },
  {
    version: "1.3.2",
    date: "2026-04-29",
    changes: [
      "슬래브 경간 검토 — 평면뷰에서 Shift+클릭으로 패널 다중 선택 + 분류명 일괄 입력 (Enter / Esc 지원)",
      "대시보드 — 패널존 효과 (Panel Zone Effects) 카드 추가 (활성화 ON/OFF + Factor 값, 새로고침 + 원본 JSON 펼침)",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-04-29",
    changes: [
      "JWT 검증을 task.dyce.kr 백엔드에 완전 위임 — sidecar에 JWT_SECRET 환경변수 불필요",
      "사용자 PC에 secret을 배포할 필요 없이 설치 후 즉시 사용 가능",
      "관리자 → 사용자 현황 페이지의 401 오류 수정",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-29",
    changes: [
      "NAVER WORKS SSO 통합 — 사내 NAVER WORKS 계정으로 단일 로그인 (task.dyce.kr SSO 공유)",
      "Electron BrowserWindow OAuth — main process가 모달 창으로 OAuth dance 처리, callback fragment IPC 가로채기",
      "관리자 → 사용자 현황 페이지 — 본 앱 자체 access log(SQLite) + 사용자별 마지막 접속 / 누적 접속 / 최근 이력",
      "ID/비밀번호 + 가입신청 폼 제거 — NAVER WORKS 단일 인증으로 일원화",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-04-27",
    changes: [
      "로그인 'Failed to fetch' 수정 — 인증 호출을 sidecar(thin proxy) 경유로 우회 (Electron origin CORS 차단 회피)",
      "backend/routers/auth.py: /login + /request 엔드포인트 추가 (api.dyce.kr 로 forward)",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-04-27",
    changes: [
      "SSO 통합: 인증을 동양구조 업무관리(api.dyce.kr)에 위임 — task.dyce.kr 가입 계정으로 로그인",
      "초기 관리자 계정 생성 / 사용자 관리 페이지 제거 — task.dyce.kr/admin/users 로 이관",
      "가입 신청 시 이메일 입력 추가 (직원 명부 자동 매칭)",
      "localStorage 토큰 키 통일 (midas_* → dy_*)",
      ".claude 자산 재구성 (역할 × 도메인 분류 + registry.yaml + lint 도구)",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-04-25",
    changes: [
      "자동 업데이트 알림에서 HTML 태그가 그대로 노출되던 문제 수정",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-25",
    changes: [
      "Load Map PDF/DXF 내보내기 (jspdf + html-to-image / ezdxf)",
      "슬래브 경간/하중/배근 자동 분석 (/member-check/slab-span)",
      "Project Settings — 그리드/축렬 자동 탐지 + 회전 그룹",
    ],
  },
  {
    version: "1.0.12",
    date: "2026-04-21",
    changes: [
      "미구성 상태(API 키 미입력)에서 /health 가 500을 반환하던 문제 수정",
      "midas_gen 내부 SystemExit를 health_check · get_settings · test_connection 에서 차단",
      "설정 파일(midas_settings.json)이 없어도 앱이 정상 기동 · 응답",
    ],
  },
  {
    version: "1.0.8",
    date: "2026-04-13",
    changes: [
      "midas-gen 공식 라이브러리 통합 (v1.5.9)",
      "MIDAS_API: URL/KEY를 midas-gen alias로 교체, Result/TableOptions re-export",
      "부재력 누적 캐싱 도입 (선택 element만 조회, 502 에러 방지)",
      "RC 보 단면 필터: 기둥(C/SC/SRC) 제외, 공백 구분 부재명 파싱 개선",
      "층 범위 매칭: 하이픈(3-5) 지원 추가",
    ],
  },
  {
    version: "1.0.7",
    date: "2026-04-08",
    changes: [
      "바닥하중 동기화 단위 kN/m 통일 + 삭제 반영",
      "MIDAS 접속 설정 영구 저장",
      "FBLD DESC에 전체 상세 정보 JSON 저장 (import 시 완전 복원)",
    ],
  },
  {
    version: "1.0.6",
    date: "2026-04-08",
    changes: [
      "Electron UX 개선 + 이중 로그인 방지",
      "앱 아이콘 256x256 이상으로 재생성",
      "electronAPI 타입 중복 선언 해결",
    ],
  },
  {
    version: "1.0.5",
    date: "2026-04-08",
    changes: [
      "로컬 API 인증 제거 (인증은 EC2 서버가 담당)",
      "SettingsSection authFetch 적용",
    ],
  },
  {
    version: "1.0.4",
    date: "2026-04-07",
    changes: [
      "가입 신청 + 관리자 승인/거절 기능",
      "EC2 인증 서버 연동 (AUTH_URL 분리)",
    ],
  },
  {
    version: "1.0.3",
    date: "2026-04-07",
    changes: [
      "로그인/인증 (SQLite + JWT)",
      "관리자 페이지 (사용자 추가/삭제)",
      "SFRS 전체 테이블 60개 (KDS 41 17 00:2022)",
      "R, Ω₀, Cd 자동 매핑",
      "작업 폴더 기능",
      "코드 품질 개선 (P1 스키마 일치, 가변 기본값 수정)",
    ],
  },
  {
    version: "1.0.2",
    date: "2026-04-07",
    changes: [
      "구조안전 및 내진설계 확인서 hwpx 자동 생성",
      "문서 작성 페이지 (/documents) 구성",
      "허용층간변위 중요도 기반 자동 설정",
      "모드 해석 상위 3개 모드 자동 수집",
      "Google Maps 키 분리 (gmaps.env)",
    ],
  },
  {
    version: "1.0.1",
    date: "2026-04-05",
    changes: [
      "Electron 자동 업데이트 지원",
      "RC보 검토 개선 + MIDAS 연동",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-04",
    changes: [
      "최초 릴리스",
      "대시보드, 하중정보, 부재검토, 탐색기",
    ],
  },
];

export default function ChangelogPage() {
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(setCurrentVersion);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">버전 기록</h1>
        <p className="text-gray-500 mt-1">
          {currentVersion ? `현재 버전: v${currentVersion}` : "MIDAS Dashboard 업데이트 내역"}
        </p>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((entry) => (
          <div
            key={entry.version}
            className={`bg-white rounded-xl border p-5 ${
              entry.version === currentVersion ? "border-[#669900] ring-1 ring-[#669900]/20" : "border-gray-200"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-bold text-gray-900">v{entry.version}</span>
              {entry.version === currentVersion && (
                <span className="text-[10px] px-2 py-0.5 bg-[#669900]/10 text-[#669900] rounded-full font-medium">현재 버전</span>
              )}
              <span className="text-xs text-gray-400">{entry.date}</span>
            </div>
            <ul className="space-y-1">
              {entry.changes.map((change, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-[#669900] mt-1 flex-shrink-0">•</span>
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
