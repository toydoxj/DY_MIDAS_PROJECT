"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Search, Weight, ClipboardCheck, ChevronLeft, ChevronRight } from "lucide-react";
import ConnectionStatus from "./ConnectionStatus";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/loadcase", label: "하중정보", icon: Weight },
  { href: "/member-check", label: "부재검토", icon: ClipboardCheck },
  { href: "/explorer", label: "탐색기", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // main content의 margin 동기화
  if (typeof window !== "undefined") {
    requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      if (main) main.style.marginLeft = collapsed ? "4rem" : "16rem";
    });
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full flex flex-col transition-all duration-200 z-30 ${collapsed ? "w-16" : "w-64"}`}
        style={{ background: "linear-gradient(180deg, #2d4a0f 0%, #1a2e08 100%)" }}
      >
        {/* 로고 */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}>
            <Image src="/dongyang_logo.svg" alt="동양구조" width={28} height={28} className="flex-shrink-0" />
            {!collapsed && (
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">MIDAS GEN NX</h1>
                <p className="text-[9px] text-[#669900]/70 -mt-0.5">API Dashboard</p>
              </div>
            )}
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
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
        <div className="p-2 border-t border-white/10 space-y-2">
          {!collapsed && <ConnectionStatus />}
          <div className={`flex items-center gap-1.5 px-3 ${collapsed ? "justify-center px-0" : ""}`}>
            <Image src="/dongyang_logo.svg" alt="" width={12} height={12} className="opacity-30 flex-shrink-0" />
            {!collapsed && <p className="text-[10px] text-gray-600">(주)동양구조</p>}
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
