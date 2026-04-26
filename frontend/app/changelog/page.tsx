"use client";

import { useState, useEffect } from "react";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
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
