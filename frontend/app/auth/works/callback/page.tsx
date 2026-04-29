"use client";

import { useEffect, useState } from "react";
import { consumeCallbackFragment, saveAuth, trackLogin } from "@/lib/auth";

export default function WorksCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1) ?error=... query (NAVER 인증 거부, 도메인 불일치 등)
    const sp = new URLSearchParams(window.location.search);
    const errParam = sp.get("error");
    if (errParam) {
      setError(decodeURIComponent(errParam));
      return;
    }

    // 2) #token=<base64url-json> fragment 파싱
    const result = consumeCallbackFragment();
    if (!result) {
      setError("인증 토큰을 확인할 수 없습니다.");
      return;
    }

    saveAuth(result.token, result.user);
    // 본 앱 access log 기록은 silent — track 응답을 기다리지 않고 navigate.
    trackLogin();
    // SPA navigation으로는 AuthGuard 재검사가 안 돈다 — hard reload 필요.
    window.location.replace(result.next || "/");
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center text-sm">
        {error ? (
          <>
            <p className="text-red-400 mb-3">로그인 실패: {error}</p>
            <a
              href="/login?error=1"
              className="text-gray-400 underline hover:text-gray-200"
            >
              로그인 페이지로 돌아가기
            </a>
          </>
        ) : (
          <p className="text-gray-400">로그인 처리 중...</p>
        )}
      </div>
    </div>
  );
}
