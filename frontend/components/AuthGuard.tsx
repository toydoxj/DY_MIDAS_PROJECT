"use client";

import { useEffect, useState, createContext, useContext, lazy, Suspense } from "react";
import {
  AuthUser,
  bootstrapAuth,
  decodeWorksToken,
  getUser,
  isLoggedIn,
  saveAuth,
  trackLogin,
} from "@/lib/auth";

const LoginForm = lazy(() => import("@/app/login/LoginForm"));

interface AuthState {
  user: AuthUser | null;
}

const AuthContext = createContext<AuthState>({ user: null });
export const useAuth = () => useContext(AuthContext);

// 같은 창 세션 동안 silent SSO 자동 시도를 1회로 제한.
// - 로그아웃 직후 재시도 차단(sessionStorage flag).
// - silent 실패 후 즉시 LoginForm 으로 fallback, 같은 세션에서 반복 시도 X.
const SILENT_SSO_BLOCKED_KEY = "dy_silent_sso_blocked";

function isSilentSsoBlocked(): boolean {
  try {
    return sessionStorage.getItem(SILENT_SSO_BLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

function blockSilentSso() {
  try { sessionStorage.setItem(SILENT_SSO_BLOCKED_KEY, "1"); } catch { /* ignore */ }
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "silent" | "login" | "ready">(
    "loading"
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  const finishReady = () => {
    setUser(getUser());
    setState("ready");
  };

  // 메모리 캐시 hydration → silent SSO(Electron 한정) → LoginForm 분기.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrapAuth();
      if (cancelled) return;
      if (isLoggedIn()) {
        finishReady();
        return;
      }
      // Electron + 차단 플래그 없음 → hidden window 로 silent SSO 시도.
      const electron = window.electronAPI;
      const canSilent = !!electron?.ssoWorksLogin && !isSilentSsoBlocked();
      if (!canSilent) {
        setState("login");
        return;
      }
      setState("silent");
      try {
        const fragment = await electron!.ssoWorksLogin!({
          next: "/",
          silent: true,
        });
        const result = decodeWorksToken(fragment);
        if (!result) {
          blockSilentSso();
          if (!cancelled) setState("login");
          return;
        }
        saveAuth(result.token, result.user);
        // access log 기록은 silent — 응답 기다리지 않는다.
        trackLogin();
        if (!cancelled) finishReady();
      } catch {
        // login_required / timeout / 사용자 취소 — 재시도하지 않고 LoginForm 으로.
        blockSilentSso();
        if (!cancelled) setState("login");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading" || state === "silent") {
    const msg = state === "silent" ? "자동 로그인 시도 중..." : "로딩 중...";
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-400 text-sm">{msg}</div>
      </div>
    );
  }

  if (state === "login") {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="text-gray-400 text-sm">로딩 중...</div></div>}>
        <LoginForm onSuccess={finishReady} />
      </Suspense>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}
