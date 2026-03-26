"use client";

import Link from "next/link";
import { Layers, Building2, Wind, Activity, Mountain } from "lucide-react";

const loadCategories = [
  { href: "/loadcase/static", label: "Static Load Case", desc: "정적 하중 케이스 관리", icon: Layers, ready: true },
  { href: "/loadcase/floor", label: "Floor Load", desc: "바닥 하중 산정", icon: Building2, ready: true },
  { href: "/loadcase/wind", label: "Wind Load", desc: "풍하중", icon: Wind, ready: false },
  { href: "/loadcase/seismic", label: "Seismic Load", desc: "지진하중", icon: Activity, ready: false },
  { href: "/loadcase/earth", label: "Earth Pressure", desc: "토압", icon: Mountain, ready: false },
];

export default function LoadCasePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">하중정보</h1>
        <p className="text-gray-400 mt-1">Load Information</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loadCategories.map(({ href, label, desc, icon: Icon, ready }) => (
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
