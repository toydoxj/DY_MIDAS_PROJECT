"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Search, Weight, ClipboardCheck, FileText, Users, ChevronLeft, ChevronRight, LogOut, User } from "lucide-react";
import ConnectionStatus from "./ConnectionStatus";
import { getUser, clearAuth } from "@/lib/auth";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/loadcase", label: "하중정보", icon: Weight },
  { href: "/member-check", label: "부재검토", icon: ClipboardCheck },
  { href: "/documents", label: "문서 작성", icon: FileText },
  { href: "/explorer", label: "탐색기", icon: Search },
  { href: "/admin", label: "사용자 관리", icon: Users, adminOnly: true },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) main.style.marginLeft = collapsed ? "4rem" : "16rem";
  }, [collapsed]);

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full flex flex-col transition-all duration-200 z-30 bg-gray-800 border-r border-gray-700 ${collapsed ? "w-16" : "w-64"}`}
      >
        {/* 로고 */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}>
            <Image src="/dongyang_logo.svg" alt="동양구조" width={28} height={28} className="flex-shrink-0 brightness-[2] saturate-0 opacity-70" />
            {!collapsed && (
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">MIDAS GEN NX</h1>
                <p className="text-[9px] text-gray-500 -mt-0.5">API Dashboard</p>
              </div>
            )}
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.filter((item) => !("adminOnly" in item && item.adminOnly) || getUser()?.role === "admin").map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  active
                    ? "bg-[#669900]/20 text-[#8cbf2d] border border-[#669900]/30"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent"
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 */}
        <div className="p-3 border-t border-gray-700 space-y-3">
          {!collapsed && <ConnectionStatus />}
          {/* 사용자 정보 + 로그아웃 */}
          {(() => { const user = getUser(); return user ? (
            <div className={`flex items-center gap-2 px-2 ${collapsed ? "justify-center px-0" : ""}`}>
              <User size={16} className="text-gray-500 flex-shrink-0" />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-300 truncate">{user.name || user.username}</p>
                  <p className="text-[10px] text-gray-500">{user.role === "admin" ? "관리자" : "사용자"}</p>
                </div>
              )}
              <button
                onClick={() => { clearAuth(); window.location.href = "/login"; }}
                title="로그아웃"
                className="text-gray-500 hover:text-red-400 transition p-1"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : null; })()}
          <div className={`flex items-center gap-3 px-2 ${collapsed ? "justify-center px-0" : ""}`}>
            <Image src="/dongyang_logo.svg" alt="동양구조" width={collapsed ? 24 : 36} height={collapsed ? 24 : 36} className="opacity-60 flex-shrink-0" />
            {!collapsed && (
              <div>
                <p className="text-sm font-semibold text-gray-300">(주)동양구조</p>
                <p className="text-[10px] text-gray-500">Dongyang Consulting Engineers</p>
              </div>
            )}
          </div>
        </div>

        {/* 접기/펼치기 버튼 */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#669900] transition-all duration-150 shadow-md"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
    </>
  );
}
