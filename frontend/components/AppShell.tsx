"use client";

import Sidebar from "./Sidebar";
import AuthGuard from "./AuthGuard";

export default function AppShell({ children }: { children: React.ReactNode }) {
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
