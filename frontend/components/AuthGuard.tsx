"use client";

import { useEffect, useState, createContext, useContext, lazy, Suspense } from "react";
import { isLoggedIn, getUser, AuthUser } from "@/lib/auth";

const LoginForm = lazy(() => import("@/app/login/LoginForm"));

interface AuthState {
  user: AuthUser | null;
}

const AuthContext = createContext<AuthState>({ user: null });
export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const checkAuth = () => {
    setState("loading");
    if (!isLoggedIn()) {
      setState("login");
      return;
    }
    setUser(getUser());
    setState("ready");
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { checkAuth(); }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (state === "login") {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="text-gray-400 text-sm">로딩 중...</div></div>}>
        <LoginForm onSuccess={checkAuth} />
      </Suspense>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}
