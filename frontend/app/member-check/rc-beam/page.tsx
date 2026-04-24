"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, Loader2, ChevronDown } from "lucide-react";
import DataTable from "@/components/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/StatusMessage";
import type {
  BeamForceMaxRow,
  MemberForceMaxRow,
  RebarType,
  SectionRebarInput,
} from "./_lib/types";
import { MaxTableIntegrated } from "./_components/MaxTableIntegrated";
import { MemberTable } from "./_components/MemberTable";
import { useRcBeamSelection } from "./_hooks/useRcBeamSelection";
import { useMidasFetch } from "./_hooks/useMidasFetch";
import { useRebarDesign } from "./_hooks/useRebarDesign";

interface SectionInfo {
  id: number;
  name: string;
  type: string;
  element_count: number;
  element_keys: number[];
}

type ViewMode = "max" | "member" | "raw";

/**
 * 부재력 기반 배근 형식 자동 판정
 * - My_neg_I 또는 My_neg_J가 0이면 BOTH
 * - I/J 편차가 50% 이상이면 BOTH (작은 쪽이 불연속단)
 * - 그 외 3단
 */
function autoDetectRebarType(force: BeamForceMaxRow): { rebarType: RebarType; swapIJ: boolean } {
  const negI = Math.abs(force.My_neg_I ?? 0);
  const negJ = Math.abs(force.My_neg_J ?? 0);

  // 둘 다 0이면 기본 3단
  if (negI === 0 && negJ === 0) return { rebarType: "type3", swapIJ: false };

  // 어느 한쪽이 0이면 BOTH
  if (negI === 0 || negJ === 0) {
    // 0인 쪽이 불연속단(J) → I가 0이면 swap 필요
    return { rebarType: "type2", swapIJ: negI < negJ };
  }

  // 편차 50% 이상이면 BOTH (작은 쪽이 불연속단 J)
  const maxVal = Math.max(negI, negJ);
  const minVal = Math.min(negI, negJ);
  if ((maxVal - minVal) / maxVal >= 0.5) {
    return { rebarType: "type2", swapIJ: negI < negJ };
  }

  return { rebarType: "type3", swapIJ: false };
}

/**
 * 부재명 구분자 (member-naming skill 기준)
 * 보: TG, TB, WG, FG, LB, G, B
 * 기둥: SRC, SC, C
 * 강구조: SRG, SRB, SG, SB
 */
const BEAM_SEPS = new Set(["TG", "TB", "WG", "FG", "LB", "G", "B"]);
/** 모든 구분자 — 긴 것부터 (prefix 충돌 방지) */
const ALL_SEPS = ["SRC", "SRG", "SRB", "SC", "SG", "SB", "TG", "TB", "WG", "FG", "LB", "G", "B", "C"] as const;
/** 번호 유효성: 숫자로 시작, 뒤에 알파벳 가능 (1, 2A, 12, 8E) */
const VALID_NUM = /^\d+[A-Za-z]*$/;

/** 문자열에서 구분자를 찾아 {floor, sep, num} 분리 */
function findSeparator(s: string): { floor: string; sep: string; num: string } | null {
  for (let i = 0; i <= s.length; i++) {
    for (const sep of ALL_SEPS) {
      if (s.substring(i, i + sep.length) === sep) {
        const num = s.substring(i + sep.length);
        // 번호가 있으면 유효해야 함 (숫자 시작), 없으면 허용
        if (num && !VALID_NUM.test(num)) continue;
        return { floor: s.substring(0, i), sep, num };
      }
    }
  }
  return null;
}

/** 단면명에서 층·구분자·번호를 파싱 (RC 보만, 기둥·강구조 제외)
 *
 * 공백 있음: "B1 G1"  → floor="B1", sep="G", num="1"
 * 공백 없음: "8G2"    → floor="8",  sep="G", num="2"
 * 공백 없음: "B1G1"   → floor="B1", sep="G", num="1" (B를 보 구분자로 오인하지 않음)
 */
function parseBeamName(name: string): { floor: string; sep: string; num: string } | null {
  const parts = name.split(/\s+/);

  let result: { floor: string; sep: string; num: string } | null;

  if (parts.length >= 2) {
    // 공백 있음: 마지막 파트가 구분자+번호, 앞부분이 층
    const floor = parts.slice(0, -1).join(" ");
    const memberPart = parts[parts.length - 1];
    const parsed = findSeparator(memberPart);
    if (!parsed) return null;
    result = { floor, sep: parsed.sep, num: parsed.num };
  } else {
    // 공백 없음: 전체에서 구분자 탐색
    result = findSeparator(name);
    if (!result) return null;
  }

  // RC 보 구분자만 통과 (기둥 C/SC/SRC, 강구조 SG/SB/SRG/SRB 제외)
  if (!BEAM_SEPS.has(result.sep)) return null;
  return result;
}

/** RC 보 단면만 필터 (구분선 "---1F---" 등 제외) */
function filterRcBeamSections(sects: SectionInfo[]): SectionInfo[] {
  return sects.filter((s) => !s.name.startsWith("---") && parseBeamName(s.name) !== null);
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

  // 범위 매칭: "3-5" 또는 "3~5" → 3,4,5층 (하이픈·틸데 모두 지원)
  const rangeMatch = floor.match(/^(-?\d+)[-~](-?\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1]);
    const hi = parseInt(rangeMatch[2]);
    const nVal = parseInt(normalizedStory);
    if (!isNaN(nVal) && nVal >= Math.min(lo, hi) && nVal <= Math.max(lo, hi)) return true;
  }

  // 불연속 매칭: "2,8"
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


const TAB_ITEMS: { key: ViewMode; label: string }[] = [
  { key: "max", label: "최대값 요약" },
  { key: "member", label: "부재별 정리" },
  { key: "raw", label: "전체 데이터" },
];

export default function RcBeamCheckPage() {
  const {
    sections,
    stories,
    result,
    maxResult,
    memberResult,
    savedRebars,
    defaults,
    loadingSections,
    loadingResult,
    error,
    lastFetchedAt,
    fetchSections,
    fetchDesignResult,
    fetchRawData,
    resetResults,
    setError,
    setSavedRebars,
  } = useMidasFetch<SectionInfo, StoryItem, BeamForceMaxRow, MemberForceMaxRow>();
  const {
    selectedStories,
    setSelectedStories,
    selectedIds,
    selectedSections,
    selectedKeys,
    selectedNames,
    filteredSections,
    totalElements,
    toggleSection,
    selectAllVisible,
    clearSelection,
  } = useRcBeamSelection<SectionInfo>({
    sections,
    filterByStories: filterSectionsByStories,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("max");

  // 호출 측에서는 재료 기본값을 단순 참조로 사용
  const { fck: defaultFck, fy: defaultFy, fyt: defaultFyt, rebarRules } = defaults;

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
  const {
    rebarSections,
    setRebarSections,
    checkResults,
    checkLoading,
    rebarSaving,
    rebarSaved,
    handleSaveRebars,
  } = useRebarDesign({
    maxResult,
    savedRebars,
    setSavedRebars,
    defaults,
    getFyForDia,
    autoDetectRebarType,
    onError: setError,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // SectName → element_keys 매핑 (MIDAS Active 표시용)
  const sectionElementMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of sections) map.set(s.name, s.element_keys);
    return map;
  }, [sections]);

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

  // 선택 해제 시 결과도 함께 초기화 (책임 분리: selection 훅은 selection만, 결과 초기화는 fetch 훅의 resetResults)
  const clearAll = () => {
    clearSelection();
    resetResults();
  };

  const handleFetch = (forceRefresh = false) => {
    if (selectedIds.size === 0) {
      setError("Section을 선택하세요.");
      return;
    }
    setDropdownOpen(false);
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
                      onClick={selectAllVisible}
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
                onClick={() => fetchDesignResult(selectedNames, true)}
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
                sectionElementMap={sectionElementMap}
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
            <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 text-center text-gray-500 text-sm leading-relaxed">
              조회된 설계결과가 없습니다.<br />
              MIDAS에서 부재설계를 진행 후 새로고침 해주세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
