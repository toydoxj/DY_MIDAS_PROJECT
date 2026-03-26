"use client";

import Link from "next/link";
import { RectangleHorizontal, Columns3, PilcrowSquare, Warehouse, BrickWall, Landmark } from "lucide-react";

const memberCategories = [
  { href: "/member-check/slab", label: "Slab Check", desc: "슬래브 검토", icon: RectangleHorizontal, ready: false },
  { href: "/member-check/rc-beam", label: "RC Beam Check", desc: "RC보 검토", icon: Columns3, ready: true },
  { href: "/member-check/rc-column", label: "RC Column Check", desc: "RC기둥 검토", icon: PilcrowSquare, ready: false },
  { href: "/member-check/steel", label: "Steel Member Check", desc: "철골 부재 검토", icon: Warehouse, ready: false },
  { href: "/member-check/wall", label: "Wall Check", desc: "벽체 검토", icon: BrickWall, ready: false },
  { href: "/member-check/foundation", label: "Foundation Check", desc: "기초 검토", icon: Landmark, ready: false },
];

export default function MemberCheckPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">부재검토</h1>
        <p className="text-gray-400 mt-1">Member Design Check</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberCategories.map(({ href, label, desc, icon: Icon, ready }) => (
          <Link key={href} href={ready ? href : "#"}
            className={`group rounded-xl border p-5 transition-all ${
              ready
                ? "bg-gray-800 border-gray-700 hover:border-blue-500 hover:bg-gray-750 cursor-pointer"
                : "bg-gray-800/50 border-gray-700/50 cursor-not-allowed opacity-60"
            }`}
            onClick={(e) => { if (!ready) e.preventDefault(); }}
          >
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-2.5 ${ready ? "bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30" : "bg-gray-700/50 text-gray-500"}`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${ready ? "text-white" : "text-gray-500"}`}>{label}</h3>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
                {!ready && <span className="inline-block mt-2 text-[10px] text-gray-600 bg-gray-700/50 rounded px-2 py-0.5">추후 구현 예정</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
