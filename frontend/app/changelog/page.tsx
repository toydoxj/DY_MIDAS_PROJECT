"use client";

import { useState, useEffect } from "react";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
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
