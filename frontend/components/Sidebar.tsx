"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Weight } from "lucide-react";
import ConnectionStatus from "./ConnectionStatus";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/loadcase", label: "하중정보", icon: Weight },
  { href: "/explorer", label: "탐색기", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">MIDAS GEN NX</h1>
        <p className="text-xs text-gray-500 mt-0.5">API Dashboard</p>
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
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <ConnectionStatus />
        <p className="text-xs text-gray-600 px-3">(주)동양구조</p>
      </div>
    </aside>
  );
}
