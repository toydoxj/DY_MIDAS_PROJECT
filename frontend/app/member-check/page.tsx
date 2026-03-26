"use client";

import { RectangleHorizontal, Columns3, PilcrowSquare, Warehouse, BrickWall, Landmark } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CategoryGrid, { CategoryItem } from "@/components/ui/CategoryGrid";

const memberCategories: CategoryItem[] = [
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
      <PageHeader title="부재검토" subtitle="Member Design Check" />
      <CategoryGrid items={memberCategories} />
    </div>
  );
}
