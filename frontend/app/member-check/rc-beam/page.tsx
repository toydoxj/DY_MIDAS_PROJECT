"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, Loader2, ChevronDown } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BACKEND_URL } from "@/lib/types";
import { flattenResponse } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/StatusMessage";
import { initSectionRebars } from "./_components/RebarInputTable";
import { saveDraftToLocal, loadDraftFromLocal, clearDraftLocal, loadRebarsFromServer, saveRebarsToServer } from "./_lib/storage";
import { REBAR_OPTIONS, REBAR_TYPE_CONFIG } from "./_lib/constants";
import type { SectionRebarInput, RebarInput, RebarType, PositionCheckResult } from "./_lib/types";

interface SectionInfo {
  id: number;
  name: string;
  type: string;
  element_count: number;
  element_keys: number[];
}

interface BeamForceMaxRow {
  SectName: string;
  B: number | null;
  H: number | null;
  D: number | null;
  My_neg_I_LC: string; My_neg_I: number;
  My_pos_I_LC: string; My_pos_I: number;
  Fz_I_LC: string; Fz_I: number;
  My_neg_C_LC: string; My_neg_C: number;
  My_pos_C_LC: string; My_pos_C: number;
  Fz_C_LC: string; Fz_C: number;
  My_neg_J_LC: string; My_neg_J: number;
  My_pos_J_LC: string; My_pos_J: number;
  Fz_J_LC: string; Fz_J: number;
}

interface MemberForceMaxRow {
  Memb: number;
  My_neg_I_LC: string; My_neg_I: number;
  My_pos_I_LC: string; My_pos_I: number;
  Fz_I_LC: string; Fz_I: number;
  My_neg_C_LC: string; My_neg_C: number;
  My_pos_C_LC: string; My_pos_C: number;
  Fz_C_LC: string; Fz_C: number;
  My_neg_J_LC: string; My_neg_J: number;
  My_pos_J_LC: string; My_pos_J: number;
  Fz_J_LC: string; Fz_J: number;
}

type ViewMode = "max" | "member" | "raw";

const POSITIONS = ["I", "C", "J"] as const;

/** RC 보 구분자만 (강구조 SG, SB, SRG, SRB 제외) */
const RC_BEAM_SEPARATORS = ["TG", "TB", "WG", "FG", "LB", "G", "B"] as const;
const RC_BEAM_SEP_REGEX = new RegExp(`^(.*?)(${RC_BEAM_SEPARATORS.join("|")})(\\d+.*)?$`);

/** 강구조 구분자 (제외용) */
const STEEL_PREFIX_REGEX = /^(.*?)(SRG|SRB|SG|SB)/;

/** 단면명에서 층 정보를 파싱 (RC만) */
function parseBeamName(name: string): { floor: string; sep: string; num: string } | null {
  // 강구조 제외
  if (STEEL_PREFIX_REGEX.test(name)) return null;
  const m = name.match(RC_BEAM_SEP_REGEX);
  if (!m) return null;
  return { floor: m[1] || "", sep: m[2], num: m[3] || "" };
}

/** RC 보 단면만 필터 */
function filterRcBeamSections(sects: SectionInfo[]): SectionInfo[] {
  return sects.filter((s) => parseBeamName(s.name) !== null);
}

interface StoryItem {
  name: string;   // STOR의 STORY_NAME (B5, 1F, Roof 등)
  level: number;
}

/** 단면명의 층 표기가 STOR 층에 포함되는지 판정 */
/** 층 이름 정규화: B5→-5, 1F→1, Roof→R 등 */
function normalizeFloor(s: string): string {
  const bm = s.match(/^B(\d+)F?$/i);
  if (bm) return `-${bm[1]}`;
  const fm = s.match(/^(\d+)F$/i);
  if (fm) return fm[1];
  if (s.toUpperCase() === "ROOF" || s.toUpperCase() === "RF") return "R";
  if (s.toUpperCase() === "PHR") return "PHR";
  if (s.toUpperCase() === "PH") return "PH";
  return s;
}

function sectionMatchesStory(sectName: string, storyName: string): boolean {
  const parsed = parseBeamName(sectName);
  if (!parsed) return false;
  const floor = parsed.floor;

  // 층 표기 없음 → 공통 (모든 층에 매칭)
  if (!floor) return true;

  const normalizedStory = normalizeFloor(storyName);
  const normalizedFloor = normalizeFloor(floor);

  // 단일 층 매칭
  if (normalizedFloor === normalizedStory) return true;

  // 범위 매칭: 2~4 → 2,3,4 (범위 내 각 토큰 정규화)
  const rangeMatch = floor.match(/^(-?\d+)~(-?\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1]);
    const hi = parseInt(rangeMatch[2]);
    const nVal = parseInt(normalizedStory);
    if (!isNaN(nVal) && nVal >= lo && nVal <= hi) return true;
  }

  // 불연속 매칭: 2,8
  if (floor.includes(",")) {
    const parts = floor.split(",").map((p) => normalizeFloor(p.trim()));
    if (parts.includes(normalizedStory)) return true;
  }

  return false;
}

/** 선택된 층에 해당하는 RC 보 sections 필터 */
/** 구분자 정렬 순서: Beam류 → Girder류 */
const SEP_ORDER: Record<string, number> = {
  B: 0, LB: 1, TB: 2, FB: 3,
  G: 10, WG: 11, TG: 12, FG: 13,
};

/** 번호 정렬: 숫자 먼저, 같은 숫자면 알파벳 순 (3 < 3A < 11) */
function numSortKey(num: string): [number, string] {
  const m = num.match(/^(\d+)(.*)/);
  if (m) return [parseInt(m[1]), m[2]];
  return [9999, num];
}

/** 층 표기 정렬키 (level 기반) */
function floorLevelKey(floor: string, stories: Set<string>): number {
  const nf = normalizeFloor(floor);
  // 범위인 경우 첫 숫자
  const rm = nf.match(/^(-?\d+)/);
  if (rm) return parseInt(rm[1]);
  if (nf === "R") return 9000;
  if (nf === "PH") return 9100;
  if (nf === "PHR") return 9200;
  return 9999;
}

function filterSectionsByStories(sects: SectionInfo[], stories: Set<string>): SectionInfo[] {
  if (stories.size === 0) return [];
  const rcSects = filterRcBeamSections(sects);
  const filtered = rcSects.filter((s) => {
    for (const st of stories) {
      if (sectionMatchesStory(s.name, st)) return true;
    }
    return false;
  });

  // 정렬: 층 → Beam/Girder → 번호
  return filtered.sort((a, b) => {
    const pa = parseBeamName(a.name)!;
    const pb = parseBeamName(b.name)!;

    // 1. 층 정렬
    const fa = floorLevelKey(pa.floor, stories);
    const fb = floorLevelKey(pb.floor, stories);
    if (fa !== fb) return fa - fb;

    // 2. 구분자 정렬 (B류 → G류)
    const sa = SEP_ORDER[pa.sep] ?? 50;
    const sb = SEP_ORDER[pb.sep] ?? 50;
    if (sa !== sb) return sa - sb;

    // 3. 번호 정렬 (3 < 3A < 11)
    const [na, xa] = numSortKey(pa.num);
    const [nb, xb] = numSortKey(pb.num);
    if (na !== nb) return na - nb;
    return xa.localeCompare(xb);
  });
}

const thCls = "px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-300";
const tdCls = "px-3 py-2 text-gray-300 whitespace-nowrap text-sm text-center";
const tdMergedCls = "px-3 py-2 text-gray-200 whitespace-nowrap text-sm font-medium text-center align-middle";

/** 통합 테이블 — 부재력 + 배근 입력 + DCR */
function MaxTableIntegrated({
  data, rebarSections, onRebarChange, checkResults, getFyForDia,
}: {
  data: BeamForceMaxRow[];
  rebarSections: SectionRebarInput[];
  onRebarChange: (sections: SectionRebarInput[]) => void;
  checkResults: PositionCheckResult[];
  getFyForDia: (dia: number) => number;
}) {
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
                return { val: Number(force[`${prefix}_${maxPos}`]) || 0, lc: (force[`${prefix}_${maxPos}_LC`] as string) ?? "" };
              };
              const myNeg = getMax("My_neg");
              const myPos = getMax("My_pos");
              const fz = getMax("Fz");

              // DCR: 첫 매핑 위치 기준
              const cr = resultMap.get(`${r.SectName}-${mappedPositions[0]}`);

              return (
                <tr key={`${gi}-${label}`} className={`${gi % 2 === 0 ? "bg-gray-800/80" : "bg-gray-900/60"} ${pi === 0 && gi > 0 ? "border-t-2 border-gray-500" : ""}`}>
                  {pi === 0 && (
                    <>
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
                  {hasResults && (cr ? dcrCell(cr.neg_flexure_dcr, cr.neg_flexure_ok) : <td className={tdCls}></td>)}
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
                  {hasResults && (cr ? dcrCell(cr.pos_flexure_dcr, cr.pos_flexure_ok) : <td className={tdCls}></td>)}
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
                  {hasResults && (cr ? dcrCell(cr.shear_dcr, cr.shear_ok) : <td className={tdCls}></td>)}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

/** rowSpan 병합 테이블 — 부재별 정리 */
function MemberTable({ data }: { data: MemberForceMaxRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className={thCls}>부재</th>
            <th className={thCls}>위치</th>
            <th className={thCls}>LC</th>
            <th className={thCls}>My(-)</th>
            <th className={thCls}>LC</th>
            <th className={thCls}>My(+)</th>
            <th className={thCls}>LC</th>
            <th className={thCls}>Fz</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {data.map((r, gi) =>
            POSITIONS.map((pos, pi) => (
              <tr key={`${gi}-${pos}`} className={`${gi % 2 === 0 ? "bg-gray-800/80" : "bg-gray-900/60"} ${pi === 0 && gi > 0 ? "border-t-2 border-gray-500" : ""}`}>
                {pi === 0 && (
                  <td className={tdMergedCls} rowSpan={3}>{r.Memb}</td>
                )}
                <td className={tdCls}>{pos}</td>
                <td className={`${tdCls} text-gray-500`}>{(r as Record<string, unknown>)[`My_neg_${pos}_LC`] as string}</td>
                <td className={tdCls}>{String((r as Record<string, unknown>)[`My_neg_${pos}`])}</td>
                <td className={`${tdCls} text-gray-500`}>{(r as Record<string, unknown>)[`My_pos_${pos}_LC`] as string}</td>
                <td className={tdCls}>{String((r as Record<string, unknown>)[`My_pos_${pos}`])}</td>
                <td className={`${tdCls} text-gray-500`}>{(r as Record<string, unknown>)[`Fz_${pos}_LC`] as string}</td>
                <td className={tdCls}>{String((r as Record<string, unknown>)[`Fz_${pos}`])}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const TAB_ITEMS: { key: ViewMode; label: string }[] = [
  { key: "max", label: "최대값 요약" },
  { key: "member", label: "부재별 정리" },
  { key: "raw", label: "전체 데이터" },
];

export default function RcBeamCheckPage() {
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null);
  const [maxResult, setMaxResult] = useState<BeamForceMaxRow[] | null>(null);
  const [memberResult, setMemberResult] = useState<MemberForceMaxRow[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("max");
  const [error, setError] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // 대시보드 재료 규칙
  interface RebarRule { strength: number; dia_threshold: number; dia_dir: string }
  const [defaultFck, setDefaultFck] = useState(27);
  const [defaultFy, setDefaultFy] = useState(400);
  const [defaultFyt, setDefaultFyt] = useState(400);
  const [rebarRules, setRebarRules] = useState<RebarRule[]>([]);

  /** 철근 지름에 맞는 강도 찾기 */
  const getFyForDia = useCallback((dia: number): number => {
    // 규칙 중 매칭되는 것 찾기 (구체적 규칙 우선)
    for (const rule of rebarRules) {
      if (rule.dia_dir === "이하" && dia <= rule.dia_threshold) return rule.strength;
      if (rule.dia_dir === "이상" && dia >= rule.dia_threshold) return rule.strength;
    }
    // 전부재 규칙
    const allRule = rebarRules.find((r) => r.dia_dir === "전부재");
    if (allRule) return allRule.strength;
    return defaultFy;
  }, [rebarRules, defaultFy]);
  const [rebarSections, setRebarSections] = useState<SectionRebarInput[]>([]);
  const [savedRebars, setSavedRebars] = useState<SectionRebarInput[]>([]);
  const [checkResults, setCheckResults] = useState<PositionCheckResult[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [rebarSaving, setRebarSaving] = useState(false);
  const [rebarSaved, setRebarSaved] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 선택된 Section들의 element_keys 합산
  const selectedKeys = useMemo(() => {
    const keys: number[] = [];
    for (const s of sections) {
      if (selectedIds.has(s.id)) keys.push(...s.element_keys);
    }
    return keys;
  }, [sections, selectedIds]);

  const selectedSections = useMemo(
    () => sections.filter((s) => selectedIds.has(s.id)),
    [sections, selectedIds],
  );

  // 선택된 층에 해당하는 RC 보 섹션 목록
  const filteredSections = useMemo(
    () => filterSectionsByStories(sections, selectedStories),
    [sections, selectedStories],
  );

  // 층 필터 변경 시 보이지 않는 선택 제거
  useEffect(() => {
    const visibleIds = new Set(filteredSections.map((s) => s.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredSections]);

  const totalElements = useMemo(
    () => selectedSections.reduce((sum, s) => sum + s.element_count, 0),
    [selectedSections],
  );

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSections = async () => {
    setLoadingSections(true);
    setError("");
    try {
      const [sectRes, storRes, projRes, rebarsData] = await Promise.all([
        fetch(`${BACKEND_URL}/api/member/sections`),
        fetch(`${BACKEND_URL}/api/midas/db/STOR`),
        fetch(`${BACKEND_URL}/api/project`),
        loadRebarsFromServer(),
      ]);
      if (!sectRes.ok) throw new Error(`Section HTTP ${sectRes.status}`);
      const data: SectionInfo[] = await sectRes.json();
      setSections(data);
      setSelectedIds(new Set());
      setResult(null);
      setMaxResult(null);
      setMemberResult(null);

      // STOR 층 정보
      if (storRes.ok) {
        const storRaw = await storRes.json();
        const stor = storRaw.STOR ?? {};
        const items: StoryItem[] = Object.values(stor)
          .filter((v): v is { STORY_NAME: string; STORY_LEVEL: number } =>
            typeof v === "object" && v !== null && "STORY_NAME" in v)
          .map((v) => ({ name: v.STORY_NAME, level: v.STORY_LEVEL }))
          .sort((a, b) => a.level - b.level);
        setStories(items);
      }

      // 대시보드 재료 강도 기본값
      if (projRes.ok) {
        try {
          const proj = await projRes.json();
          const c = JSON.parse(proj.COMMENT ?? "{}");
          const mat = c.MATERIALS_V2;
          if (mat?.concrete?.[0]?.strength) setDefaultFck(Number(mat.concrete[0].strength));
          if (mat?.rebar && Array.isArray(mat.rebar)) {
            const rules: RebarRule[] = mat.rebar.map((r: { strength?: number; dia_threshold?: number; dia_dir?: string }) => ({
              strength: Number(r.strength ?? 400),
              dia_threshold: Number(r.dia_threshold ?? 0),
              dia_dir: r.dia_dir ?? "전부재",
            }));
            setRebarRules(rules);
            // 기본값: 전부재 규칙 또는 첫 번째
            const allRule = rules.find((r) => r.dia_dir === "전부재");
            const baseStrength = allRule?.strength ?? rules[0]?.strength ?? 400;
            setDefaultFy(baseStrength);
            setDefaultFyt(baseStrength);
          }
        } catch { /* ignore */ }
      }

      // 서버 저장 배근 데이터 로드
      if (rebarsData.length > 0) setSavedRebars(rebarsData);
    } catch (e) {
      setError(`Section 조회 실패: ${e}`);
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => { fetchSections(); }, []);

  const fetchDesignResult = useCallback(async (sectionNames: string[], forceRefresh = false) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingResult(true);
    setError("");
    setMaxResult(null);
    setMemberResult(null);

    try {
      const fetchOpts = (body: unknown) => ({
        method: "POST",
        headers: { "Content-Type": "application/json" } as Record<string, string>,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      const [maxRes, memberRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/member/beam-force-max`, fetchOpts({
          section_names: sectionNames, group_by: "section", force_refresh: forceRefresh,
        })),
        fetch(`${BACKEND_URL}/api/member/beam-force-max`, fetchOpts({
          section_names: sectionNames, group_by: "member", force_refresh: forceRefresh,
        })),
      ]);

      if (controller.signal.aborted) return;

      if (!maxRes.ok) {
        const errData = await maxRes.json().catch(() => ({}));
        throw new Error(errData?.detail ?? errData?.error?.message ?? `최대값 조회 HTTP ${maxRes.status}`);
      }
      if (!memberRes.ok) {
        const errData = await memberRes.json().catch(() => ({}));
        throw new Error(errData?.detail ?? errData?.error?.message ?? `부재별 조회 HTTP ${memberRes.status}`);
      }

      const maxData: BeamForceMaxRow[] = await maxRes.json();
      const memberData: MemberForceMaxRow[] = await memberRes.json();

      if (controller.signal.aborted) return;

      setMaxResult(maxData);
      setMemberResult(memberData);
      setLastFetchedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(`설계결과 조회 실패: ${e}`);
    } finally {
      if (!controller.signal.aborted) setLoadingResult(false);
    }
  }, []);

  // 전체 데이터 탭 클릭 시에만 원시 데이터 조회
  const fetchRawData = useCallback(async (keys: number[]) => {
    if (result) return; // 이미 조회됨
    setLoadingResult(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/midas/post/TABLE`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Argument: {
            TABLE_TYPE: "BEAMDESIGNFORCES",
            UNIT: { FORCE: "KN", DIST: "M" },
            STYLES: { FORMAT: "Fixed", PLACE: 1 },
            NODE_ELEMS: { KEYS: keys },
            PARTS: ["PartI", "Part2/4", "PartJ"],
            COMPONENTS: ["Memb", "Part", "LComName", "Type", "Fz", "My(-)", "My(+)"],
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(flattenResponse(data));
    } catch (e) {
      setError(`전체 데이터 조회 실패: ${e}`);
    } finally {
      setLoadingResult(false);
    }
  }, [result]);

  const toggleSection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sections.map((s) => s.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setResult(null);
    setMaxResult(null);
    setMemberResult(null);
  };

  const selectedNames = useMemo(
    () => selectedSections.map((s) => s.name),
    [selectedSections],
  );

  const handleFetch = (forceRefresh = false) => {
    if (selectedIds.size === 0) {
      setError("Section을 선택하세요.");
      return;
    }
    setDropdownOpen(false);
    setResult(null); // 전체 데이터 캐시 초기화
    fetchDesignResult(selectedNames, forceRefresh);
  };

  const handleTabChange = (tab: ViewMode) => {
    setViewMode(tab);
    if (tab === "raw" && !result && selectedKeys.length > 0) {
      fetchRawData(selectedKeys);
    }
  };

  const rawColumns = result && result.length > 0
    ? Object.keys(result[0]).map((k) => ({ key: k, label: k }))
    : [];

  const hasData =
    (viewMode === "max" && maxResult && maxResult.length > 0) ||
    (viewMode === "member" && memberResult && memberResult.length > 0) ||
    (viewMode === "raw" && result && result.length > 0);

  const selectionKey = [...selectedIds].sort().join(",");

  // maxResult 변경 시 저장 데이터와 병합
  useEffect(() => {
    if (!maxResult || maxResult.length === 0) { setRebarSections([]); return; }
    const draft = loadDraftFromLocal();
    const saved = draft ?? savedRebars;
    const savedMap = new Map(saved.map((s) => [s.section_name, s]));
    setRebarSections(
      maxResult.map((r) => {
        const existing = savedMap.get(r.SectName);
        if (existing) return { ...existing, B: r.B ?? existing.B, H: r.H ?? existing.H };
        return initSectionRebars(r.SectName, r.B ?? 400, r.H ?? 700, defaultFck, getFyForDia(25), defaultFyt);
      })
    );
    setCheckResults([]);
  }, [maxResult]);

  // localStorage 자동 저장 (1초 디바운스)
  useEffect(() => {
    if (rebarSections.length === 0) return;
    const timer = setTimeout(() => saveDraftToLocal(rebarSections), 1000);
    return () => clearTimeout(timer);
  }, [rebarSections]);

  // 서버에 배근 저장
  const handleSaveRebars = async () => {
    setRebarSaving(true); setRebarSaved(false);
    const ok = await saveRebarsToServer(rebarSections);
    if (ok) { setRebarSaved(true); clearDraftLocal(); }
    setRebarSaving(false);
  };

  // 검토 실행
  const checkAbortRef = useRef<AbortController | null>(null);
  const runDesignCheck = useCallback(async () => {
    if (!maxResult || rebarSections.length === 0) return;
    if (checkAbortRef.current) checkAbortRef.current.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;
    setCheckLoading(true);
    try {
      const body = { sections: rebarSections, forces: maxResult };
      const res = await fetch(`${BACKEND_URL}/api/member/beam-design-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setCheckResults(await res.json());
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(String(e));
    } finally {
      if (!controller.signal.aborted) setCheckLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxResult, rebarSections]);

  // 배근/재료 변경 시 자동 검토 (300ms 디바운스)
  useEffect(() => {
    if (!maxResult || rebarSections.length === 0) return;
    const timer = setTimeout(() => { runDesignCheck(); }, 300);
    return () => clearTimeout(timer);
  }, [runDesignCheck, maxResult, rebarSections]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="RC보 검토" subtitle="Beam Design Forces" backHref="/member-check" />

      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-300">Section 선택</label>
            <button
              onClick={fetchSections}
              disabled={loadingSections}
              className="rounded-lg bg-gray-700 p-1.5 hover:bg-gray-600 transition-colors disabled:opacity-50"
              title="Section 새로고침"
            >
              <RefreshCw size={14} className={loadingSections ? "animate-spin" : ""} />
            </button>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{selectedIds.size}개 선택 · {totalElements}개 부재</span>
              <button
                onClick={() => handleFetch(false)}
                disabled={loadingResult}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {loadingResult ? "조회 중..." : "조회"}
              </button>
              <button
                onClick={() => handleFetch(true)}
                disabled={loadingResult}
                className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors disabled:opacity-50"
                title="MIDAS에서 최신 데이터 재조회"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        </div>

        {sections.length > 0 ? (
          <div className="grid grid-cols-[200px_1fr] gap-3">
            {/* 좌: 층 선택 (STOR 기반) */}
            <div className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-700 bg-gray-700/50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">층 선택</span>
                {stories.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedStories(new Set(stories.map((s) => s.name)))}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >전체</button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => setSelectedStories(new Set())}
                      className="text-[10px] text-gray-400 hover:text-gray-300"
                    >해제</button>
                  </div>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {stories.map((st) => {
                  // 해당 층의 RC 보 개수
                  const cnt = filterRcBeamSections(sections).filter((s) => sectionMatchesStory(s.name, st.name)).length;
                  return (
                    <label
                      key={st.name}
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                        selectedStories.has(st.name) ? "bg-blue-600/20 text-blue-300" : "hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedStories.has(st.name)}
                          onChange={() => {
                            setSelectedStories((prev) => {
                              const next = new Set(prev);
                              if (next.has(st.name)) next.delete(st.name);
                              else next.add(st.name);
                              return next;
                            });
                          }}
                          className="rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span>{st.name}</span>
                        <span className="text-gray-600 text-[10px]">{st.level.toFixed(1)}m</span>
                      </div>
                      {cnt > 0 && <span className="text-gray-500 text-xs">{cnt}</span>}
                    </label>
                  );
                })}
                {stories.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-500">층 데이터 없음</p>
                )}
              </div>
            </div>

            {/* 우: 보/거더 선택 */}
            <div className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-700 bg-gray-700/50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">
                  보/거더 {filteredSections.length > 0 ? `(${filteredSections.length}개)` : ""}
                </span>
                {filteredSections.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedIds(new Set(filteredSections.map((s) => s.id)))}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >전체 선택</button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-gray-400 hover:text-gray-300"
                    >해제</button>
                  </div>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {selectedStories.size === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-500 text-center">좌측에서 층을 선택하세요</p>
                ) : filteredSections.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-500 text-center">해당 층에 보 단면이 없습니다</p>
                ) : (
                  filteredSections.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                        selectedIds.has(s.id) ? "bg-blue-600/20 text-blue-300" : "hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSection(s.id)}
                          className="rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span>{s.name}</span>
                      </div>
                      <span className="text-gray-500 text-xs">{s.element_count}개</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          !loadingSections && <p className="text-sm text-gray-500">Section 데이터가 없습니다.</p>
        )}
      </SectionCard>

      {error && <ErrorText message={error} />}

      {loadingResult && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 flex items-center justify-center gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">설계결과 조회 중...</span>
        </div>
      )}

      {!loadingResult && (maxResult || memberResult || result) && (
        <>
          <div className="flex items-center gap-2">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {lastFetchedAt && (
                <span className="text-xs text-gray-500">마지막 조회: {lastFetchedAt}</span>
              )}
              <button
                onClick={() => { setResult(null); fetchDesignResult(selectedNames, true); }}
                disabled={loadingResult || selectedKeys.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 text-xs text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50"
                title="MIDAS 데이터 새로고침 (캐시 무시)"
              >
                <RefreshCw size={12} className={loadingResult ? "animate-spin" : ""} />
                새로고침
              </button>
            </div>
          </div>

          {viewMode === "max" && maxResult && maxResult.length > 0 && (
            <SectionCard
              title={`단면별 설계 검토 (${maxResult.length}개 단면)`}
              action={
                <div className="flex items-center gap-3">
                  {checkLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  {checkResults.length > 0 && !checkLoading && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${checkResults.every((r) => r.all_ok) ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                      {checkResults.every((r) => r.all_ok) ? "전체 적합" : "부적합 있음"}
                    </span>
                  )}
                  {rebarSaved && <span className="text-xs text-green-400">저장됨</span>}
                  <Button size="xs" variant="outline" onClick={handleSaveRebars} loading={rebarSaving}>
                    {rebarSaving ? "저장 중..." : "배근 저장"}
                  </Button>
                </div>
              }
            >
              <MaxTableIntegrated
                data={maxResult}
                rebarSections={rebarSections}
                onRebarChange={setRebarSections}
                checkResults={checkResults}
                getFyForDia={getFyForDia}
              />
            </SectionCard>
          )}

          {viewMode === "member" && memberResult && memberResult.length > 0 && (
            <SectionCard title={`부재별 정리 (${memberResult.length}개 부재)`}>
              <MemberTable data={memberResult} />
            </SectionCard>
          )}

          {viewMode === "raw" && result && result.length > 0 && (
            <SectionCard title={`전체 설계결과 (${result.length}개 행)`}>
              <DataTable key={`raw-${selectionKey}`} columns={rawColumns} rows={result} />
            </SectionCard>
          )}

          {!hasData && (
            <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 text-center text-gray-500 text-sm">
              조회된 설계결과가 없습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
