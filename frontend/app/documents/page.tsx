"use client";

import { FileText, ScrollText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CategoryGrid, { CategoryItem } from "@/components/ui/CategoryGrid";

const docCategories: CategoryItem[] = [
  { href: "/documents/seismic-cert", label: "내진설계 확인서", desc: "구조안전 및 내진설계 확인서 자동 생성", icon: FileText, ready: true },
  { href: "/documents/structural-calc", label: "구조계산서", desc: "구조계산서 작성", icon: ScrollText, ready: false },
];

export default function DocumentsPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="문서 작성" subtitle="Document Generation" />
      <CategoryGrid items={docCategories} />
    </div>
  );
}
