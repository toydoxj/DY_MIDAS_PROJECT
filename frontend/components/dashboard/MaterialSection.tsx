"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BACKEND_URL } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { SavedBadge } from "@/components/ui/StatusMessage";

type MaterialCategory = "콘크리트" | "철근" | "강재";

interface MaterialRow {
  category: MaterialCategory;
  name: string;
  strength: string;
  usage: string;
}

const CATEGORY_OPTIONS: MaterialCategory[] = ["콘크리트", "철근", "강재"];

const DEFAULT_ROWS: MaterialRow[] = [
  { category: "콘크리트", name: "C27", strength: "27", usage: "기둥, 보, 슬래브" },
  { category: "철근", name: "SD400", strength: "400", usage: "주근" },
  { category: "철근", name: "SD400", strength: "400", usage: "스터럽" },
];

export default function MaterialSection() {
  const [rows, setRows] = useState<MaterialRow[]>(DEFAULT_ROWS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/project`)
      .then((r) => r.json())
      .then((d) => {
        try {
          const c = JSON.parse(d.COMMENT ?? "{}");
          if (c.MATERIALS && Array.isArray(c.MATERIALS) && c.MATERIALS.length > 0) {
            setRows(c.MATERIALS);
          }
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  const updateRow = (idx: number, patch: Partial<MaterialRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = (category: MaterialCategory) => {
    const defaults: Record<MaterialCategory, MaterialRow> = {
      "콘크리트": { category: "콘크리트", name: "", strength: "27", usage: "" },
      "철근": { category: "철근", name: "", strength: "400", usage: "" },
      "강재": { category: "강재", name: "", strength: "235", usage: "" },
    };
    setRows((prev) => {
      // 해당 카테고리의 마지막 행 뒤에 삽입
      let lastIdx = -1;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].category === category) lastIdx = i;
      }
      const newRow = defaults[category];
      if (lastIdx === -1) return [...prev, newRow];
      const next = [...prev];
      next.splice(lastIdx + 1, 0, newRow);
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/project`);
      if (!res.ok) throw new Error("프로젝트 조회 실패");
      const proj = await res.json();
      let comment: Record<string, unknown> = {};
      try { comment = JSON.parse(proj.COMMENT ?? "{}"); } catch { /* ignore */ }
      comment.MATERIALS = rows;

      const saveRes = await fetch(`${BACKEND_URL}/api/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proj, COMMENT: JSON.stringify(comment) }),
      });
      if (!saveRes.ok) throw new Error("저장 실패");
      setSaved(true);
    } catch (err) {
      console.warn("재료 강도 저장 실패:", err);
    } finally { setSaving(false); }
  };

  // 카테고리별 그룹핑 (rowSpan 계산)
  const grouped: { category: MaterialCategory; startIdx: number; count: number }[] = [];
  let prevCat = "";
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].category !== prevCat) {
      grouped.push({ category: rows[i].category, startIdx: i, count: 1 });
      prevCat = rows[i].category;
    } else {
      grouped[grouped.length - 1].count++;
    }
  }
  const rowSpanMap = new Map<number, number>();
  for (const g of grouped) rowSpanMap.set(g.startIdx, g.count);

  const thCls = "px-3 py-2 text-center text-xs font-semibold text-muted-foreground";
  const tdCls = "px-2 py-1.5 text-center text-sm";
  const inputCls = "w-full rounded bg-muted border border-border px-2 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <SectionCard as="form" title="재료 강도" onSubmit={handleSave}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={thCls}>구분</th>
              <th className={thCls}>명칭</th>
              <th className={thCls}>강도 (MPa)</th>
              <th className={thCls}>적용</th>
              <th className={`${thCls} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                {rowSpanMap.has(i) && (
                  <td className={`${tdCls} font-medium text-foreground align-middle`} rowSpan={rowSpanMap.get(i)}>
                    {row.category}
                  </td>
                )}
                <td className={tdCls}>
                  <input className={inputCls} value={row.name} placeholder="명칭"
                    onChange={(e) => updateRow(i, { name: e.target.value })} />
                </td>
                <td className={tdCls}>
                  <input className={inputCls} type="number" value={row.strength} placeholder="MPa"
                    onChange={(e) => updateRow(i, { strength: e.target.value })} />
                </td>
                <td className={tdCls}>
                  <input className={inputCls} value={row.usage} placeholder="적용 부위"
                    onChange={(e) => updateRow(i, { usage: e.target.value })} />
                </td>
                <td className={tdCls}>
                  <button type="button" onClick={() => removeRow(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        {CATEGORY_OPTIONS.map((cat) => (
          <Button key={cat} type="button" variant="outline" size="xs" onClick={() => addRow(cat)}>
            <Plus size={12} /> {cat}
          </Button>
        ))}
        <div className="flex-1" />
        {saved && <SavedBadge label="저장됨" />}
        <Button type="submit" size="xs" loading={saving}>
          {saving ? "저장 중..." : "MIDAS에 업데이트"}
        </Button>
      </div>
    </SectionCard>
  );
}
