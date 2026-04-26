"use client";

import { useCallback, useState } from "react";
import { activateElementsInMidas } from "../_lib/midas";
import { REBAR_OPTIONS, REBAR_TYPE_CONFIG } from "../_lib/constants";
import { thCls, tdCls, tdMergedCls } from "../_lib/styles";
import type {
  BeamForceMaxRow,
  PositionCheckResult,
  RebarInput,
  RebarType,
  SectionRebarInput,
} from "../_lib/types";

/** 통합 테이블 — 부재력 + 배근 입력 + DCR */
export function MaxTableIntegrated({
  data, rebarSections, onRebarChange, checkResults, getFyForDia, sectionElementMap,
}: {
  data: BeamForceMaxRow[];
  rebarSections: SectionRebarInput[];
  onRebarChange: (sections: SectionRebarInput[]) => void;
  checkResults: PositionCheckResult[];
  getFyForDia: (dia: number) => number;
  sectionElementMap: Map<string, number[]>;
}) {
  const [checkedSections, setCheckedSections] = useState<Set<string>>(new Set());

  const applyHighlight = useCallback(async (selectedNames: Set<string>) => {
    const allKeys: number[] = [];
    for (const name of selectedNames) {
      const ek = sectionElementMap.get(name);
      if (ek) allKeys.push(...ek);
    }
    await activateElementsInMidas(allKeys);
  }, [sectionElementMap]);

  const toggleCheck = useCallback(async (sectName: string) => {
    const next = new Set(checkedSections);
    if (next.has(sectName)) next.delete(sectName); else next.add(sectName);
    setCheckedSections(next);
    await applyHighlight(next);
  }, [checkedSections, applyHighlight]);

  const toggleCheckAll = useCallback(async () => {
    const allNames = data.map((r) => r.SectName);
    const allChecked = allNames.every((n) => checkedSections.has(n));
    const next = allChecked ? new Set<string>() : new Set(allNames);
    setCheckedSections(next);
    await applyHighlight(next);
  }, [data, checkedSections, applyHighlight]);

  const rebarMap = new Map(rebarSections.map((s, i) => [s.section_name, i]));
  const resultMap = new Map<string, PositionCheckResult>();
  for (const r of checkResults) resultMap.set(`${r.section_name}-${r.position}`, r);

  // 단면 단위 배근 업데이트 (모든 위치에 동일 적용)
  const updateSectionRebar = (si: number, patch: Partial<RebarInput>) => {
    const next = rebarSections.map((s, i) => {
      if (i !== si) return s;
      return { ...s, rebars: s.rebars.map((r) => ({ ...r, ...patch })) };
    });
    onRebarChange(next);
  };

  // 위치별 배근 업데이트 (개수만)
  const updatePositionCount = (si: number, ri: number, patch: Partial<RebarInput>) => {
    const next = rebarSections.map((s, i) => {
      if (i !== si) return s;
      return { ...s, rebars: s.rebars.map((r, j) => (j === ri ? { ...r, ...patch } : r)) };
    });
    onRebarChange(next);
  };

  const inputCls = "w-12 rounded bg-gray-700 border border-gray-600 px-1 py-0.5 text-[11px] text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500";
  const selectCls = "w-14 rounded bg-gray-700 border border-gray-600 px-0.5 py-0.5 text-[11px] text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500";

  const hasResults = checkResults.length > 0;

  const dcrCell = (dcr: number, ok: boolean) => (
    <td className={`${tdCls} font-mono font-semibold text-center ${ok ? "text-green-400" : "text-red-400"}`}>
      {dcr < 900 ? dcr.toFixed(3) : "-"}
    </td>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-700">
          <tr>
            <th className={thCls}>
              <input type="checkbox"
                checked={data.length > 0 && data.every((r) => checkedSections.has(r.SectName))}
                onChange={toggleCheckAll}
                className="w-3.5 h-3.5 rounded bg-gray-600 border-gray-500 cursor-pointer accent-blue-500"
              />
            </th>
            <th className={thCls}>단면</th>
            <th className={thCls}>B×H</th>
            <th className={thCls}>Type</th>
            <th className={thCls}>위치</th>
            <th className={thCls}>표기</th>
            <th className={`${thCls} border-l border-gray-600`}>My(-)</th>
            <th className={thCls}>상부근</th>
            {hasResults && <th className={thCls}>휨DCR</th>}
            <th className={`${thCls} border-l border-gray-600`}>My(+)</th>
            <th className={thCls}>하부근</th>
            {hasResults && <th className={thCls}>휨DCR</th>}
            <th className={`${thCls} border-l border-gray-600`}>Fz</th>
            <th className={thCls}>스터럽</th>
            {hasResults && <th className={thCls}>전단DCR</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {data.map((r, gi) => {
            const si = rebarMap.get(r.SectName);
            const sec = si !== undefined ? rebarSections[si] : null;
            const rb0 = sec?.rebars[0];
            const rType = sec?.rebarType ?? "type3";
            const typeConfig = REBAR_TYPE_CONFIG[rType];
            const posLabels = typeConfig.positions;
            const rowCount = posLabels.length;

            // type에 따른 I/C/J 매핑
            const posMap: ("I" | "C" | "J")[][] = rType === "type1"
              ? [["I", "C", "J"]]  // ALL: 3개 중 최대
              : rType === "type2"
              ? [["I", "J"], ["C"]]  // 양단(I+J 최대), 중앙
              : [["I"], ["C"], ["J"]];  // 연속단, 중앙, 불연속단

            return posLabels.map((label, pi) => {
              const rb = sec?.rebars[pi];
              const mappedPositions = posMap[pi];
              // 해당 위치들 중 최대 부재력
              const force = r as unknown as Record<string, unknown>;
              const getMax = (prefix: string) => {
                let maxVal = 0;
                let maxPos = mappedPositions[0];
                for (const p of mappedPositions) {
                  const v = Math.abs(Number(force[`${prefix}_${p}`]) || 0);
                  if (v > maxVal) { maxVal = v; maxPos = p; }
                }
                return { val: Number(force[`${prefix}_${maxPos}`]) || 0, lc: (force[`${prefix}_${maxPos}_LC`] as string) ?? "", pos: maxPos };
              };
              const myNeg = getMax("My_neg");
              const myPos = getMax("My_pos");
              const fz = getMax("Fz");

              // DCR: 각 부재력의 지배적 위치에서 가져옴
              const crNeg = resultMap.get(`${r.SectName}-${myNeg.pos}`);
              const crPos = resultMap.get(`${r.SectName}-${myPos.pos}`);
              const crShear = resultMap.get(`${r.SectName}-${fz.pos}`);

              return (
                <tr key={`${gi}-${label}`} className={`${gi % 2 === 0 ? "bg-gray-800/80" : "bg-gray-900/60"} ${pi === 0 && gi > 0 ? "border-t-2 border-gray-500" : ""}`}>
                  {pi === 0 && (
                    <>
                      <td className={`${tdMergedCls} align-middle`} rowSpan={rowCount}>
                        <input type="checkbox"
                          checked={checkedSections.has(r.SectName)}
                          onChange={() => toggleCheck(r.SectName)}
                          className="w-3.5 h-3.5 rounded bg-gray-600 border-gray-500 cursor-pointer accent-blue-500"
                        />
                      </td>
                      <td className={tdMergedCls} rowSpan={rowCount}>{r.SectName}</td>
                      <td className={`${tdMergedCls} font-mono text-xs`} rowSpan={rowCount}>{r.B ?? "-"}×{r.H ?? "-"}</td>
                      <td className={tdMergedCls} rowSpan={rowCount}>
                        {si !== undefined && sec ? (
                          <select className={selectCls} value={sec.rebarType}
                            onChange={(e) => { const next = [...rebarSections]; next[si] = { ...sec, rebarType: e.target.value as RebarType }; onRebarChange(next); }}>
                            <option value="type3">3단</option>
                            <option value="type2">BOTH</option>
                            <option value="type1">ALL</option>
                          </select>
                        ) : "-"}
                      </td>
                    </>
                  )}
                  <td className={`${tdCls} text-blue-400 font-medium`}>{label}</td>
                  <td className={tdCls}>
                    {rb && si !== undefined && (
                      <input className={inputCls} value={rb.note ?? ""} placeholder=""
                        onChange={(e) => updatePositionCount(si, pi, { note: e.target.value })} />
                    )}
                  </td>
                  {/* My(-) + 상부근 (n-Dxx) */}
                  <td className={`${tdCls} font-mono border-l border-gray-600`}>
                    <div className="text-white">{myNeg.val.toFixed(1)}</div>
                    <div className="text-gray-400 text-[10px] truncate max-w-[80px]" title={myNeg.lc}>{myNeg.lc}</div>
                  </td>
                  <td className={tdCls}>
                    {rb && si !== undefined && (
                      <div className="flex items-center gap-0.5 justify-center whitespace-nowrap">
                        <input className={inputCls} type="number" min={0} value={rb.top_count}
                          onChange={(e) => updatePositionCount(si, pi, { top_count: Number(e.target.value) || 0 })} />
                        <span className="text-gray-500">-</span>
                        {pi === 0 ? (
                          <select className={selectCls} value={rb.top_dia}
                            onChange={(e) => {
                              const d = Number(e.target.value);
                              const newFy = getFyForDia(d);
                              const next = rebarSections.map((s, i) => {
                                if (i !== si) return s;
                                return {
                                  ...s,
                                  fy: newFy,
                                  rebars: s.rebars.map((r) => ({ ...r, top_dia: d, bot_dia: d })),
                                };
                              });
                              onRebarChange(next);
                            }}>
                            {REBAR_OPTIONS.map((o) => <option key={o.dia} value={o.dia}>{o.label}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-300 text-[11px]">D{rb0?.top_dia ?? rb.top_dia}</span>
                        )}
                      </div>
                    )}
                  </td>
                  {hasResults && (crNeg ? dcrCell(crNeg.neg_flexure_dcr, crNeg.neg_flexure_ok) : <td className={tdCls}></td>)}
                  {/* My(+) + 하부근 (n-Dxx) */}
                  <td className={`${tdCls} font-mono border-l border-gray-600`}>
                    <div className="text-white">{myPos.val.toFixed(1)}</div>
                    <div className="text-gray-400 text-[10px] truncate max-w-[80px]" title={myPos.lc}>{myPos.lc}</div>
                  </td>
                  <td className={tdCls}>
                    {rb && si !== undefined && (
                      <div className="flex items-center gap-0.5 justify-center whitespace-nowrap">
                        <input className={inputCls} type="number" min={0} value={rb.bot_count}
                          onChange={(e) => updatePositionCount(si, pi, { bot_count: Number(e.target.value) || 0 })} />
                        <span className="text-gray-500">-</span>
                        <span className="text-gray-300 text-[11px]">D{rb0?.bot_dia ?? rb.bot_dia}</span>
                      </div>
                    )}
                  </td>
                  {hasResults && (crPos ? dcrCell(crPos.pos_flexure_dcr, crPos.pos_flexure_ok) : <td className={tdCls}></td>)}
                  {/* Fz + 스터럽 (Dxx@nnn) */}
                  <td className={`${tdCls} font-mono border-l border-gray-600`}>
                    <div className="text-white">{fz.val.toFixed(1)}</div>
                    <div className="text-gray-400 text-[10px] truncate max-w-[80px]" title={fz.lc}>{fz.lc}</div>
                  </td>
                  <td className={tdCls}>
                    {rb && si !== undefined && (
                      <div className="flex items-center gap-0.5 justify-center whitespace-nowrap">
                        {pi === 0 ? (
                          <input className={inputCls} type="number" min={1} max={6} value={rb.stirrup_legs ?? 2}
                            onChange={(e) => updateSectionRebar(si, { stirrup_legs: Number(e.target.value) || 2 })} />
                        ) : (
                          <span className="text-gray-300 text-[11px] w-10 text-center">{rb0?.stirrup_legs ?? 2}</span>
                        )}
                        <span className="text-gray-500">-</span>
                        {pi === 0 ? (
                          <select className={selectCls} value={rb.stirrup_dia}
                            onChange={(e) => updateSectionRebar(si, { stirrup_dia: Number(e.target.value) })}>
                            {REBAR_OPTIONS.filter((o) => o.dia <= 16).map((o) => <option key={o.dia} value={o.dia}>{o.label}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-300 text-[11px]">D{rb0?.stirrup_dia ?? rb.stirrup_dia}</span>
                        )}
                        <span className="text-gray-500">@</span>
                        <input className={inputCls} type="number" min={50} step={25} value={rb.stirrup_spacing}
                          onChange={(e) => updatePositionCount(si, pi, { stirrup_spacing: Number(e.target.value) || 200 })} />
                      </div>
                    )}
                  </td>
                  {hasResults && (crShear ? dcrCell(crShear.shear_dcr, crShear.shear_ok) : <td className={tdCls}></td>)}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
