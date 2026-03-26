"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface CategoryItem {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  ready: boolean;
}

interface CategoryCardProps {
  item: CategoryItem;
}

export function CategoryCard({ item: { href, label, desc, icon: Icon, ready } }: CategoryCardProps) {
  return (
    <Link
      href={ready ? href : "#"}
      className={`group rounded-xl border p-5 transition-all ${
        ready
          ? "bg-gray-800 border-gray-700 hover:border-blue-500 hover:bg-gray-750 cursor-pointer"
          : "bg-gray-800/50 border-gray-700/50 cursor-not-allowed opacity-60"
      }`}
      onClick={(e: React.MouseEvent) => { if (!ready) e.preventDefault(); }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`rounded-lg p-2.5 ${
            ready
              ? "bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30"
              : "bg-gray-700/50 text-gray-500"
          }`}
        >
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${ready ? "text-white" : "text-gray-500"}`}>
            {label}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{desc}</p>
          {!ready && (
            <span className="inline-block mt-2 text-[10px] text-gray-600 bg-gray-700/50 rounded px-2 py-0.5">
              추후 구현 예정
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface CategoryGridProps {
  items: CategoryItem[];
}

export default function CategoryGrid({ items }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <CategoryCard key={item.href} item={item} />
      ))}
    </div>
  );
}
