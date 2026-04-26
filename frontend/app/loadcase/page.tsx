"use client";

import { Layers, Building2, Wind, Activity, Mountain, Map } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CategoryGrid, { CategoryItem } from "@/components/ui/CategoryGrid";

const loadCategories: CategoryItem[] = [
  { href: "/loadcase/static", label: "Load Case", desc: "하중 케이스 관리", icon: Layers, ready: true },
  { href: "/loadcase/floor", label: "Floor Load", desc: "바닥 하중 산정", icon: Building2, ready: true },
  { href: "/loadcase/load-map", label: "Load Map", desc: "층별 프레임 + Floor Load 시각화", icon: Map, ready: true },
  { href: "/loadcase/wind", label: "Wind Load", desc: "풍하중", icon: Wind, ready: false },
  { href: "/loadcase/seismic", label: "Seismic Load", desc: "지진하중", icon: Activity, ready: true },
  { href: "/loadcase/earth", label: "Earth Pressure", desc: "토압", icon: Mountain, ready: false },
];

export default function LoadCasePage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="하중정보" subtitle="Load Information" />
      <CategoryGrid items={loadCategories} />
    </div>
  );
}
