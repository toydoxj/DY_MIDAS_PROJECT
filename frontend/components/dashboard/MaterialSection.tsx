"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BACKEND_URL } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { SavedBadge } from "@/components/ui/StatusMessage";

/* ── 콘크리트 ── */
interface ConcreteRow {
  strength: number;
  horizontal: string; // 층 범위 (수평재)
  vertical: string;   // 층 범위 (수직재)
}

const FCK_OPTIONS = [21, 24, 27, 30, 35, 40, 50, 60];

/* ── 철근 ── */
interface RebarRow {
  grade: string;      // SD400 등
  strength: number;
  usage: string;      // "D16이하", "D19이상", "전부재"
  member: string;     // 적용 부재
}

const REBAR_GRADES = ["SD300", "SD400", "SD500", "SD550", "SD600"];
const REBAR_STRENGTHS: Record<string, number> = { SD300: 300, SD400: 400, SD500: 500, SD550: 550, SD600: 600 };
const REBAR_USAGE_OPTIONS = ["전부재", "D16이하", "D19이상"];

/* ── 강재 ── */
interface SteelRow {
  grade: string;      // SS275 등
  strength: number;
  member: string;     // 적용 부재
}

const STEEL_GRADES = ["SS235", "SS275", "SS315", "SS355", "SS410", "SM355", "SM490", "SN400", "SN490"];
const STEEL_STRENGTHS: Record<string, number> = {
  SS235: 235, SS275: 275, SS315: 315, SS355: 355, SS410: 410,
  SM355: 355, SM490: 490, SN400: 235, SN490: 315,
};

/* ── 저장 구조 ── */
interface MaterialData {
  concrete: ConcreteRow[];
  rebar: RebarRow[];
  steel: SteelRow[];
}

const DEFAULT_DATA: MaterialData = {
  concrete: [{ strength: 27, horizontal: "전층", vertical: "전층" }],
  rebar: [
    { grade: "SD400", strength: 400, usage: "전부재", member: "주근, 스터럽" },
  ],
  steel: [],
};

export default function MaterialSection() {
  const [data, setData] = useState<MaterialData>(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/project`)
      .then((r) => r.json())
      .then((d) => {
        try {
          const c = JSON.parse(d.COMMENT ?? "{}");
          if (c.MATERIALS_V2) setData(c.MATERIALS_V2);
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/project`);
      if (!res.ok) throw new Error("프로젝트 조회 실패");
      const proj = await res.json();
      let comment: Record<string, unknown> = {};
      try { comment = JSON.parse(proj.COMMENT ?? "{}"); } catch { /* ignore */ }
      comment.MATERIALS_V2 = data;

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

  const thCls = "px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground";
  const tdCls = "px-1.5 py-1 text-center text-sm";
  const inputCls = "w-full rounded bg-muted border border-border px-2 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring";
  const selectCls = "w-full rounded bg-muted border border-border px-1.5 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <SectionCard as="form" title="재료 강도" onSubmit={handleSave}>
      {/* ── 콘크리트 ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">콘크리트</span>
          <Button type="button" variant="ghost" size="xs"
            onClick={() => setData((p) => ({ ...p, concrete: [...p.concrete, { strength: 27, horizontal: "", vertical: "" }] }))}>
            <Plus size={12} /> 추가
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={thCls}>강도 (MPa)</th>
                <th className={thCls}>수평재 (층)</th>
                <th className={thCls}>수직재 (층)</th>
                <th className={`${thCls} w-8`}></th>
              </tr>
            </thead>
            <tbody>
              {data.concrete.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className={tdCls}>
                    <select className={selectCls} value={row.strength}
                      onChange={(e) => {
                        const next = [...data.concrete];
                        next[i] = { ...row, strength: Number(e.target.value) };
                        setData((p) => ({ ...p, concrete: next }));
                      }}>
                      {FCK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className={tdCls}>
                    <input className={inputCls} value={row.horizontal} placeholder="전층"
                      onChange={(e) => {
                        const next = [...data.concrete];
                        next[i] = { ...row, horizontal: e.target.value };
                        setData((p) => ({ ...p, concrete: next }));
                      }} />
                  </td>
                  <td className={tdCls}>
                    <input className={inputCls} value={row.vertical} placeholder="전층"
                      onChange={(e) => {
                        const next = [...data.concrete];
                        next[i] = { ...row, vertical: e.target.value };
                        setData((p) => ({ ...p, concrete: next }));
                      }} />
                  </td>
                  <td className={tdCls}>
                    <button type="button" onClick={() => setData((p) => ({ ...p, concrete: p.concrete.filter((_, j) => j !== i) }))}
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 철근 ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">철근</span>
          <Button type="button" variant="ghost" size="xs"
            onClick={() => setData((p) => ({ ...p, rebar: [...p.rebar, { grade: "SD400", strength: 400, usage: "전부재", member: "" }] }))}>
            <Plus size={12} /> 추가
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={thCls}>규격</th>
                <th className={thCls}>강도 (MPa)</th>
                <th className={thCls}>적용</th>
                <th className={thCls}>부재</th>
                <th className={`${thCls} w-8`}></th>
              </tr>
            </thead>
            <tbody>
              {data.rebar.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className={tdCls}>
                    <select className={selectCls} value={row.grade}
                      onChange={(e) => {
                        const grade = e.target.value;
                        const next = [...data.rebar];
                        next[i] = { ...row, grade, strength: REBAR_STRENGTHS[grade] ?? row.strength };
                        setData((p) => ({ ...p, rebar: next }));
                      }}>
                      {REBAR_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </td>
                  <td className={`${tdCls} text-muted-foreground`}>{row.strength}</td>
                  <td className={tdCls}>
                    <select className={selectCls} value={row.usage}
                      onChange={(e) => {
                        const next = [...data.rebar];
                        next[i] = { ...row, usage: e.target.value };
                        setData((p) => ({ ...p, rebar: next }));
                      }}>
                      {REBAR_USAGE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className={tdCls}>
                    <input className={inputCls} value={row.member} placeholder="주근, 스터럽 등"
                      onChange={(e) => {
                        const next = [...data.rebar];
                        next[i] = { ...row, member: e.target.value };
                        setData((p) => ({ ...p, rebar: next }));
                      }} />
                  </td>
                  <td className={tdCls}>
                    <button type="button" onClick={() => setData((p) => ({ ...p, rebar: p.rebar.filter((_, j) => j !== i) }))}
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 강재 ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">강재</span>
          <Button type="button" variant="ghost" size="xs"
            onClick={() => setData((p) => ({ ...p, steel: [...p.steel, { grade: "SS275", strength: 275, member: "" }] }))}>
            <Plus size={12} /> 추가
          </Button>
        </div>
        {data.steel.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className={thCls}>규격</th>
                  <th className={thCls}>강도 (MPa)</th>
                  <th className={thCls}>적용 부재</th>
                  <th className={`${thCls} w-8`}></th>
                </tr>
              </thead>
              <tbody>
                {data.steel.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className={tdCls}>
                      <select className={selectCls} value={row.grade}
                        onChange={(e) => {
                          const grade = e.target.value;
                          const next = [...data.steel];
                          next[i] = { ...row, grade, strength: STEEL_STRENGTHS[grade] ?? row.strength };
                          setData((p) => ({ ...p, steel: next }));
                        }}>
                        {STEEL_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className={`${tdCls} text-muted-foreground`}>{row.strength}</td>
                    <td className={tdCls}>
                      <input className={inputCls} value={row.member} placeholder="기둥, 보 등"
                        onChange={(e) => {
                          const next = [...data.steel];
                          next[i] = { ...row, member: e.target.value };
                          setData((p) => ({ ...p, steel: next }));
                        }} />
                    </td>
                    <td className={tdCls}>
                      <button type="button" onClick={() => setData((p) => ({ ...p, steel: p.steel.filter((_, j) => j !== i) }))}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground px-2">강재 없음 — 위 버튼으로 추가</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        {saved && <SavedBadge label="저장됨" />}
        <Button type="submit" size="xs" loading={saving} className="ml-auto">
          {saving ? "저장 중..." : "MIDAS에 업데이트"}
        </Button>
      </div>
    </SectionCard>
  );
}
