"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LayoutDashboard, Search, Weight, ClipboardCheck } from "lucide-react";
import ConnectionStatus from "./ConnectionStatus";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/loadcase", label: "하중정보", icon: Weight },
  { href: "/member-check", label: "부재검토", icon: ClipboardCheck },
  { href: "/explorer", label: "탐색기", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)" }}>
      {/* 로고 */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image src="/dongyang_logo.svg" alt="동양구조" width={32} height={32} />
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">MIDAS GEN NX</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">API Dashboard</p>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <ConnectionStatus />
        <div className="flex items-center gap-1.5 px-3">
          <Image src="/dongyang_logo.svg" alt="" width={14} height={14} className="opacity-50" />
          <p className="text-[10px] text-gray-500">(주)동양구조</p>
        </div>
      </div>
    </aside>
  );
}
