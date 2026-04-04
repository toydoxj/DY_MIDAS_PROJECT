"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BACKEND_URL, StoryRow } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { SavedBadge } from "@/components/ui/StatusMessage";

/* ── 철근 지름 ── */
const REBAR_DIAS = [10, 13, 16, 19, 22, 25, 29, 32, 35] as const;

/* ── 콘크리트 ── */
interface ConcreteRow {
  strength: number;
  h_from: string; h_to: string;  // 수평재 층 범위
  v_from: string; v_to: string;  // 수직재 층 범위
}
const FCK_OPTIONS = [21, 24, 27, 30, 35, 40, 50, 60];

/* ── 철근 ── */
interface RebarRow {
  grade: string;
  strength: number;
  dia_threshold: number;   // 기준 지름 (예: 19)
  dia_dir: string;         // "이하" | "이상" | "전부재"
  member: string;
}
const REBAR_GRADES = ["SD300", "SD400", "SD500", "SD550", "SD600"];
const REBAR_STRENGTHS: Record<string, number> = { SD300: 300, SD400: 400, SD500: 500, SD550: 550, SD600: 600 };

/* ── 강재 ── */
interface SteelRow {
  grade: string;
  strength: number;
  member: string;
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
  concrete: [{ strength: 27, h_from: "", h_to: "", v_from: "", v_to: "" }],
  rebar: [{ grade: "SD400", strength: 400, dia_threshold: 0, dia_dir: "전부재", member: "주근, 스터럽" }],
  steel: [],
};

export default function MaterialSection({ storyRows }: { storyRows: StoryRow[] }) {
  const [data, setData] = useState<MaterialData>(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 층 이름 목록 (STOR 순서)
  const storyNames = storyRows.map((r) => r.STORY_NAME);

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
  const selectCls = "w-full rounded bg-muted border border-border px-1.5 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring";
  const inputCls = selectCls;

  /** 층 Select */
  const StorySelect = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {storyNames.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  return (
    <SectionCard as="form" title="재료 강도" onSubmit={handleSave}>
      {/* ── 콘크리트 ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">콘크리트</span>
          <Button type="button" variant="ghost" size="xs"
            onClick={() => setData((p) => ({ ...p, concrete: [...p.concrete, { strength: 27, h_from: "", h_to: "", v_from: "", v_to: "" }] }))}>
            <Plus size={12} /> 추가
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={thCls} rowSpan={2}>강도</th>
                <th className={thCls} colSpan={2}>수평재 (층)</th>
                <th className={thCls} colSpan={2}>수직재 (층)</th>
                <th className={`${thCls} w-8`} rowSpan={2}></th>
              </tr>
              <tr className="border-b border-border bg-muted/50">
                <th className={thCls}>부터</th>
                <th className={thCls}>까지</th>
                <th className={thCls}>부터</th>
                <th className={thCls}>까지</th>
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
                    <StorySelect value={row.h_from} placeholder="전층"
                      onChange={(v) => { const next = [...data.concrete]; next[i] = { ...row, h_from: v }; setData((p) => ({ ...p, concrete: next })); }} />
                  </td>
                  <td className={tdCls}>
                    <StorySelect value={row.h_to} placeholder="전층"
                      onChange={(v) => { const next = [...data.concrete]; next[i] = { ...row, h_to: v }; setData((p) => ({ ...p, concrete: next })); }} />
                  </td>
                  <td className={tdCls}>
                    <StorySelect value={row.v_from} placeholder="전층"
                      onChange={(v) => { const next = [...data.concrete]; next[i] = { ...row, v_from: v }; setData((p) => ({ ...p, concrete: next })); }} />
                  </td>
                  <td className={tdCls}>
                    <StorySelect value={row.v_to} placeholder="전층"
                      onChange={(v) => { const next = [...data.concrete]; next[i] = { ...row, v_to: v }; setData((p) => ({ ...p, concrete: next })); }} />
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
            onClick={() => setData((p) => ({ ...p, rebar: [...p.rebar, { grade: "SD400", strength: 400, dia_threshold: 0, dia_dir: "전부재", member: "" }] }))}>
            <Plus size={12} /> 추가
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={thCls}>규격</th>
                <th className={thCls}>강도</th>
                <th className={thCls} colSpan={2}>적용</th>
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
                    {row.dia_dir === "전부재" ? (
                      <select className={selectCls} value="전부재"
                        onChange={(e) => {
                          const next = [...data.rebar];
                          next[i] = { ...row, dia_dir: e.target.value, dia_threshold: e.target.value === "전부재" ? 0 : 19 };
                          setData((p) => ({ ...p, rebar: next }));
                        }}>
                        <option value="전부재">전부재</option>
                        <option value="이하">이하</option>
                        <option value="이상">이상</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-0.5 justify-center">
                        <select className={`${selectCls} w-16`} value={row.dia_threshold}
                          onChange={(e) => {
                            const next = [...data.rebar];
                            next[i] = { ...row, dia_threshold: Number(e.target.value) };
                            setData((p) => ({ ...p, rebar: next }));
                          }}>
                          {REBAR_DIAS.map((d) => <option key={d} value={d}>D{d}</option>)}
                        </select>
                        <select className={`${selectCls} w-14`} value={row.dia_dir}
                          onChange={(e) => {
                            const next = [...data.rebar];
                            next[i] = { ...row, dia_dir: e.target.value, dia_threshold: e.target.value === "전부재" ? 0 : row.dia_threshold || 19 };
                            setData((p) => ({ ...p, rebar: next }));
                          }}>
                          <option value="전부재">전부재</option>
                          <option value="이하">이하</option>
                          <option value="이상">이상</option>
                        </select>
                      </div>
                    )}
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
                  <th className={thCls}>강도</th>
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
