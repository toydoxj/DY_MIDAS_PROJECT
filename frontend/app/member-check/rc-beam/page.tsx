"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, Loader2, ChevronDown } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BACKEND_URL } from "@/lib/types";
import { flattenResponse } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import Button from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/StatusMessage";
import MaterialInput from "./_components/MaterialInput";
import { initSectionRebars } from "./_components/RebarInputTable";
import { DEFAULT_FCK, DEFAULT_FY, DEFAULT_FYT, REBAR_OPTIONS } from "./_lib/constants";
import type { SectionRebarInput, RebarInput, PositionCheckResult } from "./_lib/types";

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

const thCls = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-300";
const tdCls = "px-3 py-2 text-gray-300 whitespace-nowrap text-sm";
const tdMergedCls = "px-3 py-2 text-gray-200 whitespace-nowrap text-sm font-medium align-middle";

/** 통합 테이블 — 부재력 + 배근 입력 + DCR */
function MaxTableIntegrated({
  data, rebarSections, onRebarChange, checkResults,
}: {
  data: BeamForceMaxRow[];
  rebarSections: SectionRebarInput[];
  onRebarChange: (sections: SectionRebarInput[]) => void;
  checkResults: PositionCheckResult[];
}) {
  const rebarMap = new Map(rebarSections.map((s, i) => [s.section_name, i]));
  const resultMap = new Map<string, PositionCheckResult>();
  for (const r of checkResults) resultMap.set(`${r.section_name}-${r.position}`, r);

  const updateRebar = (si: number, ri: number, patch: Partial<RebarInput>) => {
    const next = rebarSections.map((s, i) => {
      if (i !== si) return s;
      return { ...s, rebars: s.rebars.map((r, j) => (j === ri ? { ...r, ...patch } : r)) };
    });
    onRebarChange(next);
  };

  const inputCls = "w-14 rounded bg-gray-700 border border-gray-600 px-1 py-0.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500";
  const selectCls = "w-16 rounded bg-gray-700 border border-gray-600 px-0.5 py-0.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500";

  const hasResults = checkResults.length > 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-700">
          <tr>
            <th className={thCls} rowSpan={2}>단면</th>
            <th className={thCls} rowSpan={2}>B×H</th>
            <th className={thCls} rowSpan={2}>위치</th>
            <th className={thCls} colSpan={2}>My(-)</th>
            <th className={thCls} colSpan={2}>My(+)</th>
            <th className={thCls} colSpan={2}>Fz</th>
            <th className={thCls} colSpan={2}>상부근</th>
            <th className={thCls} colSpan={2}>하부근</th>
            <th className={thCls} colSpan={2}>스터럽</th>
            {hasResults && (
              <>
                <th className={thCls}>휨DCR</th>
                <th className={thCls}>전단DCR</th>
                <th className={thCls}>철근비</th>
                <th className={thCls}>스터럽</th>
              </>
            )}
          </tr>
          <tr>
            <th className={thCls}>LC</th><th className={thCls}>kN·m</th>
            <th className={thCls}>LC</th><th className={thCls}>kN·m</th>
            <th className={thCls}>LC</th><th className={thCls}>kN</th>
            <th className={thCls}>규격</th><th className={thCls}>개수</th>
            <th className={thCls}>규격</th><th className={thCls}>개수</th>
            <th className={thCls}>규격</th><th className={thCls}>간격</th>
            {hasResults && (
              <><th className={thCls}></th><th className={thCls}></th><th className={thCls}></th><th className={thCls}></th></>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {data.map((r, gi) => {
            const si = rebarMap.get(r.SectName);
            const sec = si !== undefined ? rebarSections[si] : null;
            return POSITIONS.map((pos, pi) => {
              const rb = sec?.rebars[pi];
              const cr = resultMap.get(`${r.SectName}-${pos}`);
              const force = r as unknown as Record<string, unknown>;
              return (
                <tr key={`${gi}-${pos}`} className={gi % 2 === 0 ? "bg-gray-800" : "bg-gray-800/50"}>
                  {pi === 0 && (
                    <>
                      <td className={tdMergedCls} rowSpan={3}>{r.SectName}</td>
                      <td className={`${tdMergedCls} font-mono text-xs`} rowSpan={3}>{r.B ?? "-"}×{r.H ?? "-"}</td>
                    </>
                  )}
                  <td className={`${tdCls} text-blue-400 font-medium`}>{pos}</td>
                  <td className={`${tdCls} text-gray-500 text-[10px]`}>{force[`My_neg_${pos}_LC`] as string}</td>
                  <td className={`${tdCls} font-mono`}>{String(force[`My_neg_${pos}`])}</td>
                  <td className={`${tdCls} text-gray-500 text-[10px]`}>{force[`My_pos_${pos}_LC`] as string}</td>
                  <td className={`${tdCls} font-mono`}>{String(force[`My_pos_${pos}`])}</td>
                  <td className={`${tdCls} text-gray-500 text-[10px]`}>{force[`Fz_${pos}_LC`] as string}</td>
                  <td className={`${tdCls} font-mono`}>{String(force[`Fz_${pos}`])}</td>
                  {rb && si !== undefined ? (
                    <>
                      <td className={tdCls}>
                        <select className={selectCls} value={rb.top_dia} onChange={(e) => updateRebar(si, pi, { top_dia: Number(e.target.value) })}>
                          {REBAR_OPTIONS.map((o) => <option key={o.dia} value={o.dia}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className={tdCls}>
                        <input className={inputCls} type="number" min={0} value={rb.top_count} onChange={(e) => updateRebar(si, pi, { top_count: Number(e.target.value) || 0 })} />
                      </td>
                      <td className={tdCls}>
                        <select className={selectCls} value={rb.bot_dia} onChange={(e) => updateRebar(si, pi, { bot_dia: Number(e.target.value) })}>
                          {REBAR_OPTIONS.map((o) => <option key={o.dia} value={o.dia}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className={tdCls}>
                        <input className={inputCls} type="number" min={0} value={rb.bot_count} onChange={(e) => updateRebar(si, pi, { bot_count: Number(e.target.value) || 0 })} />
                      </td>
                      <td className={tdCls}>
                        <select className={selectCls} value={rb.stirrup_dia} onChange={(e) => updateRebar(si, pi, { stirrup_dia: Number(e.target.value) })}>
                          {REBAR_OPTIONS.filter((o) => o.dia <= 16).map((o) => <option key={o.dia} value={o.dia}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className={tdCls}>
                        <input className={inputCls} type="number" min={50} step={25} value={rb.stirrup_spacing} onChange={(e) => updateRebar(si, pi, { stirrup_spacing: Number(e.target.value) || 200 })} />
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className={tdCls}></td>
                  )}
                  {hasResults && (
                    cr ? (
                      <>
                        <td className={`${tdCls} font-mono font-semibold ${cr.flexure_ok ? "text-green-400" : "text-red-400"}`}>
                          {cr.flexure_dcr < 900 ? cr.flexure_dcr.toFixed(3) : "-"}
                        </td>
                        <td className={`${tdCls} font-mono font-semibold ${cr.shear_ok ? "text-green-400" : "text-red-400"}`}>
                          {cr.shear_dcr < 900 ? cr.shear_dcr.toFixed(3) : "-"}
                        </td>
                        <td className={`${tdCls} text-center ${cr.rho_min_ok && cr.rho_max_ok ? "text-green-400" : "text-red-400"}`}>
                          {cr.rho_min_ok && cr.rho_max_ok ? "✓" : "✗"}
                        </td>
                        <td className={`${tdCls} text-center ${cr.stirrup_ok ? "text-green-400" : "text-red-400"}`}>
                          {cr.stirrup_ok ? "✓" : "✗"}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className={tdCls}></td>
                    )
                  )}
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
              <tr key={`${gi}-${pos}`} className={gi % 2 === 0 ? "bg-gray-800" : "bg-gray-800/50"}>
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

  // 설계 검토 상태
  const [fck, setFck] = useState(DEFAULT_FCK);
  const [fy, setFy] = useState(DEFAULT_FY);
  const [fyt, setFyt] = useState(DEFAULT_FYT);
  const [rebarSections, setRebarSections] = useState<SectionRebarInput[]>([]);
  const [checkResults, setCheckResults] = useState<PositionCheckResult[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);

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
      const res = await fetch(`${BACKEND_URL}/api/member/sections`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SectionInfo[] = await res.json();
      setSections(data);
      setSelectedIds(new Set());
      setResult(null);
      setMaxResult(null);
      setMemberResult(null);
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
            STYLES: { FORMAT: "Fixed", PLACE: 3 },
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

  // maxResult 변경 시 배근 입력 폼 초기화
  useEffect(() => {
    if (!maxResult || maxResult.length === 0) { setRebarSections([]); return; }
    setRebarSections(
      maxResult.map((r) => initSectionRebars(r.SectName, r.B ?? 400, r.H ?? 700))
    );
    setCheckResults([]);
  }, [maxResult]);

  // 검토 실행
  const runDesignCheck = async () => {
    if (!maxResult || rebarSections.length === 0) return;
    setCheckLoading(true);
    try {
      const body = {
        fck, fy, fyt,
        sections: rebarSections,
        forces: maxResult,
      };
      const res = await fetch(`${BACKEND_URL}/api/member/beam-design-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setCheckResults(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="RC보 검토" subtitle="Beam Design Forces" backHref="/member-check" />

      <SectionCard>
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

        {sections.length > 0 ? (
          <div ref={dropdownRef} className="relative">
            {/* 드롭다운 트리거 */}
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-left text-gray-200 hover:bg-gray-600 transition-colors"
            >
              <span className={selectedIds.size === 0 ? "text-gray-400" : ""}>
                {selectedIds.size === 0
                  ? "Section을 선택하세요"
                  : `${selectedIds.size}개 Section 선택됨 (${totalElements}개 부재)`}
              </span>
              <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* 체크박스 리스트 */}
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-gray-800 border border-gray-600 shadow-xl">
                {/* 전체 선택/해제 */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
                  <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">전체 선택</button>
                  <span className="text-gray-600">|</span>
                  <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-300">전체 해제</button>
                </div>
                {sections.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSection(s.id)}
                      className="rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">
                      {s.id} — {s.name}
                      <span className="text-gray-500 ml-1">({s.element_count}개)</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          !loadingSections && <p className="text-sm text-gray-500">Section 데이터가 없습니다.</p>
        )}

        {/* 선택 요약 + 조회 버튼 */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              선택: {selectedSections.map((s) => s.name).join(", ")} · 총 {totalElements}개 부재
            </p>
            <div className="flex items-center gap-2">
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
          </div>
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
                  {checkResults.length > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${checkResults.every((r) => r.all_ok) ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                      {checkResults.every((r) => r.all_ok) ? "전체 적합" : "부적합 있음"}
                    </span>
                  )}
                  <Button size="xs" onClick={runDesignCheck} loading={checkLoading}>
                    {checkLoading ? "검토 중..." : "설계 검토"}
                  </Button>
                </div>
              }
            >
              <MaterialInput
                fck={fck} fy={fy} fyt={fyt}
                onChange={(v) => { if (v.fck !== undefined) setFck(v.fck); if (v.fy !== undefined) setFy(v.fy); if (v.fyt !== undefined) setFyt(v.fyt); }}
              />
              <MaxTableIntegrated
                data={maxResult}
                rebarSections={rebarSections}
                onRebarChange={setRebarSections}
                checkResults={checkResults}
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
