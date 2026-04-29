"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  decodeWorksToken,
  saveAuth,
  trackLogin,
  worksLoginUrl,
} from "@/lib/auth";

interface Props {
  onSuccess: () => void;
}

// Electron 환경에서는 window.location.origin이 app://-라 hard navigate redirect는
// 불가하지만, main process의 BrowserWindow IPC(ssoWorksLogin)를 통해 SSO 가능.
function isElectronEnv(): boolean {
  if (typeof window === "undefined") return false;
  if (window.electronAPI?.isElectron) return true;
  const origin = window.location.origin || "";
  return !origin.startsWith("http://") && !origin.startsWith("https://");
}

export default function LoginForm({ onSuccess }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 진입 시 NAVER WORKS SSO 자동 redirect (브라우저 한정).
  // - ?error=... 또는 ?manual=1 query 있으면 redirect 차단 (무한 루프 방지)
  // - Electron은 BrowserWindow IPC 방식 (사용자 클릭 트리거)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("error") || sp.get("manual")) {
      const e = sp.get("error");
      if (e) setError(decodeURIComponent(e));
      return;
    }
    if (isElectronEnv()) return;
    window.location.replace(worksLoginUrl("/"));
  }, []);

  // Electron NAVER WORKS SSO — main process가 BrowserWindow로 OAuth 처리 후
  // raw fragment를 IPC로 반환. 디코딩 → saveAuth → onSuccess.
  const handleElectronWorksLogin = async () => {
    if (!window.electronAPI?.ssoWorksLogin) {
      setError("이 빌드는 SSO를 지원하지 않습니다. 앱을 최신 버전으로 업데이트하세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const rawFragment = await window.electronAPI.ssoWorksLogin({ next: "/" });
      const result = decodeWorksToken(rawFragment);
      if (!result) {
        setError("인증 토큰을 해석할 수 없습니다.");
        return;
      }
      saveAuth(result.token, result.user);
      trackLogin();
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "로그인 실패";
      // 사용자가 창을 닫은 경우는 조용히 처리
      if (msg !== "로그인이 취소되었습니다") setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/dongyang_logo.svg" alt="동양구조" width={48} height={48} className="mx-auto mb-4 opacity-70" />
          <h1 className="text-xl font-bold text-white">MIDAS GEN NX Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">(주)동양구조</p>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-3">
          {isElectronEnv() ? (
            <button
              type="button"
              onClick={handleElectronWorksLogin}
              disabled={loading}
              className="block w-full text-center py-2.5 text-sm font-medium rounded-lg bg-[#00C73C] text-white hover:bg-[#00b035] disabled:opacity-50 transition"
            >
              {loading ? "로그인 창 처리 중..." : "NAVER WORKS로 로그인"}
            </button>
          ) : (
            <a
              href={
                typeof window !== "undefined"
                  ? worksLoginUrl("/")
                  : "/api/auth/works/login"
              }
              className="block w-full text-center py-2.5 text-sm font-medium rounded-lg bg-[#00C73C] text-white hover:bg-[#00b035] transition"
            >
              NAVER WORKS로 로그인
            </a>
          )}
          <p className="text-[11px] text-gray-500 text-center">
            사내 NAVER WORKS 계정으로 로그인합니다.
          </p>
          {error && <p className="text-xs text-red-400 text-center pt-2">{error}</p>}
        </div>
        <noscript>
          <p className="text-xs text-gray-400 text-center mt-3">
            JavaScript가 꺼져 있습니다. 위의 NAVER WORKS 로그인 버튼을 직접
            누르세요.
          </p>
        </noscript>
      </div>
    </div>
  );
}
