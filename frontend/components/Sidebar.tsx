"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Weight, ClipboardCheck, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import ConnectionStatus from "./ConnectionStatus";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/loadcase", label: "하중정보", icon: Weight },
  { href: "/member-check", label: "부재검토", icon: ClipboardCheck },
  { href: "/explorer", label: "탐색기", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // 초기 로드 시 저장된 테마 적용
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      setDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">MIDAS GEN NX</h1>
          <p className="text-xs text-muted-foreground mt-0.5">API Dashboard</p>
        </div>
        <button
          onClick={toggleTheme}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={dark ? "라이트 모드" : "다크 모드"}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <ConnectionStatus />
        <p className="text-xs text-muted-foreground px-3">(주)동양구조</p>
      </div>
    </aside>
  );
}
