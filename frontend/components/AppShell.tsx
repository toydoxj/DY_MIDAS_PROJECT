"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AuthGuard from "./AuthGuard";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  // SSO callback은 인증 검사/사이드바를 모두 우회 (fragment 파싱 전에 LoginForm
  // 표시되면 무한 루프 + cache 차단을 위해 standalone layout)
  if (pathname.startsWith("/auth/works/callback")) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-6 transition-all duration-200" id="main-content">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
