"use client";

import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { REBAR_OPTIONS, DEFAULT_COVER } from "../_lib/constants";
import type { SectionRebarInput, RebarInput } from "../_lib/types";

interface Props {
  sections: SectionRebarInput[];
  onChange: (sections: SectionRebarInput[]) => void;
}

const POSITIONS: RebarInput["position"][] = ["I", "C", "J"];

function defaultRebar(pos: RebarInput["position"]): RebarInput {
  return { position: pos, top_dia: 25, top_count: 3, bot_dia: 25, bot_count: 3, stirrup_dia: 10, stirrup_legs: 2, stirrup_spacing: 200, cover: DEFAULT_COVER };
}

export function initSectionRebars(sectName: string, B: number, H: number, fck = 27, fy = 400, fyt = 400): SectionRebarInput {
  return { section_name: sectName, B, H, fck, fy, fyt, rebarType: "type3", rebars: POSITIONS.map(defaultRebar) };
}

export default function RebarInputTable({ sections, onChange }: Props) {
  const updateRebar = (si: number, ri: number, patch: Partial<RebarInput>) => {
    const next = sections.map((s, i) => {
      if (i !== si) return s;
      return { ...s, rebars: s.rebars.map((r, j) => (j === ri ? { ...r, ...patch } : r)) };
    });
    onChange(next);
  };

  const applyFirstToAll = () => {
    if (sections.length === 0) return;
    const first = sections[0].rebars;
    const next = sections.map((s) => ({
      ...s,
      rebars: s.rebars.map((r, i) => ({ ...first[i], position: r.position })),
    }));
    onChange(next);
  };

  const th = "px-2 py-1.5 text-center text-gray-400 font-medium text-[10px] uppercase";
  const td = "px-2 py-1 text-center";
  const inputCls = "w-full rounded bg-gray-700 border border-gray-600 px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500";
  const selectCls = inputCls;

  return (
    <SectionCard
      title="배근 정보 입력"
      action={
        sections.length > 1 ? (
          <Button size="xs" variant="ghost" onClick={applyFirstToAll}>첫 행 전체 적용</Button>
        ) : undefined
      }
    >
      {sections.length === 0 ? (
        <p className="text-sm text-gray-500">부재력 조회 후 입력 가능</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className={th}>단면</th>
                <th className={th}>B×H</th>
                <th className={th}>위치</th>
                <th className={th}>상부근</th>
                <th className={th}>개수</th>
                <th className={th}>하부근</th>
                <th className={th}>개수</th>
                <th className={th}>스터럽</th>
                <th className={th}>간격(mm)</th>
                <th className={th}>피복(mm)</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec, si) =>
                sec.rebars.map((rb, ri) => (
                  <tr key={`${sec.section_name}-${rb.position}`} className="border-b border-gray-700/30">
                    {ri === 0 && (
                      <>
                        <td className={`${td} text-white font-medium`} rowSpan={3}>{sec.section_name}</td>
                        <td className={`${td} text-gray-300 font-mono`} rowSpan={3}>{sec.B}×{sec.H}</td>
                      </>
                    )}
                    <td className={`${td} text-blue-400 font-medium`}>{rb.position}</td>
                    <td className={td}>
                      <select className={selectCls} value={rb.top_dia} onChange={(e) => updateRebar(si, ri, { top_dia: Number(e.target.value) })}>
                        {REBAR_OPTIONS.map((r) => <option key={r.dia} value={r.dia}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <input className={inputCls} type="number" min={0} value={rb.top_count} onChange={(e) => updateRebar(si, ri, { top_count: Number(e.target.value) || 0 })} />
                    </td>
                    <td className={td}>
                      <select className={selectCls} value={rb.bot_dia} onChange={(e) => updateRebar(si, ri, { bot_dia: Number(e.target.value) })}>
                        {REBAR_OPTIONS.map((r) => <option key={r.dia} value={r.dia}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <input className={inputCls} type="number" min={0} value={rb.bot_count} onChange={(e) => updateRebar(si, ri, { bot_count: Number(e.target.value) || 0 })} />
                    </td>
                    <td className={td}>
                      <select className={selectCls} value={rb.stirrup_dia} onChange={(e) => updateRebar(si, ri, { stirrup_dia: Number(e.target.value) })}>
                        {REBAR_OPTIONS.filter((r) => r.dia <= 16).map((r) => <option key={r.dia} value={r.dia}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <input className={inputCls} type="number" min={50} step={25} value={rb.stirrup_spacing} onChange={(e) => updateRebar(si, ri, { stirrup_spacing: Number(e.target.value) || 200 })} />
                    </td>
                    <td className={td}>
                      <input className={inputCls} type="number" min={20} value={rb.cover} onChange={(e) => updateRebar(si, ri, { cover: Number(e.target.value) || DEFAULT_COVER })} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
