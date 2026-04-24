"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Loader2, Play, Info, Save, FolderOpen, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/ui/StatusMessage";
import DataTable, { type CellRenderer } from "@/components/DataTable";
import { BACKEND_URL } from "@/lib/types";
import type {
  FloorLoadBreakdownItem,
  LevelReport,
  SlabSectionItem,
  SlabSpanAnalyzeResponse,
  SnapshotFull,
  SnapshotListItem,
  Story,
} from "./_lib/types";
import SlabPlanView from "./_components/SlabPlanView";
import SlabSectionsTable from "./_components/SlabSectionsTable";

const PANEL_COLUMNS = [
  { key: "custom_name", label: "분류 (S)" },
  { key: "short_span", label: "단변 (m)" },
  { key: "long_span", label: "장변 (m)" },
  { key: "slab_type", label: "유형" },
  { key: "floor_load_name", label: "하중명" },
  { key: "floor_load_factored", label: "Wu (kN/㎡)" },
];

function panelToRow(
  p: LevelReport["panels"][number],
  customName: string,
): Record<string, unknown> {
  return {
    // panel_id / z_level 은 식별자/콜백용 (표시 컬럼 아님)
    panel_id: p.panel_id,
    z_level: p.z_level,
    custom_name: customName,
    long_span: p.long_span.toFixed(2),
    short_span: p.short_span.toFixed(2),
    slab_type: p.slab_type,
    floor_load_name: p.floor_load_name ?? "–",
    floor_load_factored:
      p.floor_load_factored != null ? p.floor_load_factored.toFixed(2) : "–",
    // 팝오버 렌더러가 사용할 breakdown 정보는 row.__matches 로 전달
    __matches: p.floor_load_matches ?? [],
  };
}


function FloorLoadNameCell({
  name,
  matches,
}: {
  name: string;
  matches: FloorLoadBreakdownItem[];
}) {
  if (matches.length < 2) {
    return <span>{name}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{name}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 hover:text-amber-200 transition"
            title={`${matches.length}개 하중 영역 매칭됨 — 세부내역 보기`}
          >
            <Info size={11} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="right"
            sideOffset={6}
            className="z-50 min-w-[300px] rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl animate-in fade-in-0 zoom-in-95"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
              <span>매칭된 하중 {matches.length}개</span>
              <span className="text-[10px] text-gray-500">Wu 내림차순</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-gray-500 border-b border-gray-700">
                  <th className="pb-1.5 text-left font-medium">이름</th>
                  <th className="pb-1.5 text-right font-medium">DL</th>
                  <th className="pb-1.5 text-right font-medium">LL</th>
                  <th className="pb-1.5 text-right font-medium">Wu</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr
                    key={`${m.name}-${i}`}
                    className={
                      m.is_primary
                        ? "bg-[#669900]/15 text-white"
                        : "text-gray-300"
                    }
                  >
                    <td className="py-1 pr-3 font-medium">
                      {m.is_primary && (
                        <span className="mr-1 text-[#8cbf2d]">★</span>
                      )}
                      {m.name}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono">
                      {m.dl.toFixed(2)}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono">
                      {m.ll.toFixed(2)}
                    </td>
                    <td className="py-1 text-right font-mono font-semibold">
                      {m.factored.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-gray-500">
              ★ = 대표값 (Wu 최대) · 단위 kN/㎡
            </p>
            <Popover.Arrow className="fill-gray-900" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}

const FLOOR_LOAD_NAME_RENDERER: CellRenderer = (value, row) => {
  const name = String(value ?? "–");
  const matches = (row.__matches as FloorLoadBreakdownItem[] | undefined) ?? [];
  return <FloorLoadNameCell name={name} matches={matches} />;
};

export default function SlabSpanPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [excludeInput, setExcludeInput] = useState<string>("");
  const [loadingStories, setLoadingStories] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [response, setResponse] = useState<SlabSpanAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverPanelByLevel, setHoverPanelByLevel] = useState<Record<number, string | null>>({});
  const [selectedPanelByLevel, setSelectedPanelByLevel] = useState<Record<number, string | null>>({});
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const nameMapLoadedRef = useRef(false);

  // 저장된 슬래브 이름 매핑 초기 로드
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/member/slab-span/names`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (data && typeof data === "object") {
          setNameMap(data as Record<string, string>);
        }
        nameMapLoadedRef.current = true;
      })
      .catch(() => {
        nameMapLoadedRef.current = true;
      });
  }, []);

  // 변경 시 debounced 저장 (500ms)
  useEffect(() => {
    if (!nameMapLoadedRef.current) return;
    const t = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/member/slab-span/names`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nameMap),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [nameMap]);

  const updateSlabName = useCallback((panelId: string, name: string) => {
    setNameMap((prev) => {
      const next = { ...prev };
      if (name.trim()) next[panelId] = name;
      else delete next[panelId];
      return next;
    });
  }, []);

  // ── 슬래브 배근표 (분류 단위) ──
  const [sections, setSections] = useState<SlabSectionItem[]>([]);
  const sectionsLoadedRef = useRef(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/member/slab-span/sections`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setSections(data as SlabSectionItem[]);
        sectionsLoadedRef.current = true;
      })
      .catch(() => {
        sectionsLoadedRef.current = true;
      });
  }, []);

  // debounced auto-save
  useEffect(() => {
    if (!sectionsLoadedRef.current) return;
    const t = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/member/slab-span/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sections),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [sections]);

  // 분류명 → 해당 분류의 THK 빠른 조회 맵 (각 층 테이블 배지용)
  const thkByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sections) {
      const n = s.name.trim();
      if (n && s.thk != null) m[n] = s.thk;
    }
    return m;
  }, [sections]);

  // 분석 결과에서 사용된 유니크 분류명 (자동 추가 안내용)
  const autoNames = useMemo(() => {
    const set = new Set<string>();
    const vals = Object.values(nameMap);
    for (const v of vals) {
      const trimmed = v.trim();
      if (trimmed) set.add(trimmed);
    }
    return Array.from(set).sort();
  }, [nameMap]);

  // ── 스냅샷 관리 ──
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [snapshotName, setSnapshotName] = useState<string>("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const reloadSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/member/slab-span/snapshots`);
      if (!res.ok) return;
      const data: SnapshotListItem[] = await res.json();
      setSnapshots(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reloadSnapshots();
  }, [reloadSnapshots]);

  const saveSnapshot = useCallback(async () => {
    const name = snapshotName.trim();
    if (!name) {
      setError("스냅샷 이름을 입력하세요");
      return;
    }
    if (!response) {
      setError("저장할 분석 결과가 없습니다. 먼저 분석을 실행하세요.");
      return;
    }
    setSnapshotBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/member/slab-span/snapshots/${encodeURIComponent(name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis: response,
            names: nameMap,
            sections,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `저장 실패 (${res.status})`);
      }
      await reloadSnapshots();
      setSelectedSnapshot(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSnapshotBusy(false);
    }
  }, [snapshotName, response, nameMap, sections, reloadSnapshots]);

  const loadSnapshot = useCallback(async () => {
    const name = selectedSnapshot.trim();
    if (!name) return;
    setSnapshotBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/member/slab-span/snapshots/${encodeURIComponent(name)}`,
      );
      if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
      const data: SnapshotFull = await res.json();
      setResponse(data.analysis);
      setNameMap(data.names ?? {});
      if (Array.isArray(data.sections)) setSections(data.sections);
      setSnapshotName(data.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSnapshotBusy(false);
    }
  }, [selectedSnapshot]);

  const deleteSnapshot = useCallback(async () => {
    const name = selectedSnapshot.trim();
    if (!name) return;
    if (!window.confirm(`스냅샷 "${name}"을(를) 삭제할까요?`)) return;
    setSnapshotBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/member/slab-span/snapshots/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
      setSelectedSnapshot("");
      await reloadSnapshots();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSnapshotBusy(false);
    }
  }, [selectedSnapshot, reloadSnapshots]);

  const loadStories = useCallback(async () => {
    setLoadingStories(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/member/slab-span/stories`);
      if (!res.ok) throw new Error(`층 목록 조회 실패 (${res.status})`);
      const data: Story[] = await res.json();
      setStories(data);
      // 전체 층 기본 선택
      setSelectedStories(new Set(data.map((s) => s.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingStories(false);
    }
  }, []);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  const toggleStory = (name: string) => {
    setSelectedStories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStories.size === stories.length) setSelectedStories(new Set());
    else setSelectedStories(new Set(stories.map((s) => s.name)));
  };

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setResponse(null);
    try {
      const prefixes = excludeInput
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const body = {
        story_names: selectedStories.size > 0 ? Array.from(selectedStories) : null,
        exclude_section_prefixes: prefixes,
      };
      const res = await fetch(`${BACKEND_URL}/api/member/slab-span/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `분석 실패 (${res.status})`);
      }
      const data: SlabSpanAnalyzeResponse = await res.json();
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }, [selectedStories, excludeInput]);

  const summary = useMemo(() => {
    if (!response) return null;
    const oneWay = response.reports.reduce((a, r) => a + r.one_way_count, 0);
    const twoWay = response.reports.reduce((a, r) => a + r.two_way_count, 0);
    const maxSpan = Math.max(0, ...response.reports.map((r) => r.max_span));
    return {
      total: response.total_panels,
      oneWay,
      twoWay,
      maxSpan,
      levels: response.level_count,
      loadAreas: response.floor_load_area_count ?? 0,
      loadMatched: response.floor_load_matched_count ?? 0,
    };
  }, [response]);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="슬래브 경간 검토"
        subtitle="Slab Span Check — 층별 패널 자동 탐지 및 1방향/2방향 판정"
        backHref="/member-check"
      />

      {error && <AlertBanner type="error" message={error} />}

      {/* 층 선택 */}
      <SectionCard
        title="분석 대상 층"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={toggleAll} disabled={loadingStories || stories.length === 0}>
              {selectedStories.size === stories.length ? "전체 해제" : "전체 선택"}
            </Button>
            <Button size="sm" variant="outline" onClick={loadStories} disabled={loadingStories}>
              {loadingStories && <Loader2 className="animate-spin" size={14} />}
              새로고침
            </Button>
            <Button size="sm" onClick={runAnalyze} disabled={analyzing || selectedStories.size === 0}>
              {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
              분석 실행
            </Button>
          </div>
        }
      >
        {loadingStories ? (
          <p className="text-sm text-gray-400">층 목록 로딩 중...</p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-gray-400">층(/db/STOR) 데이터가 없습니다. MIDAS 연결 상태를 확인하세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {stories.map((s) => {
              const checked = selectedStories.has(s.name);
              return (
                <label
                  key={s.name}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                    checked
                      ? "border-[#669900]/40 bg-[#669900]/10 text-white"
                      : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStory(s.name)}
                    className="accent-[#669900]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500">EL {s.level.toFixed(2)} m</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 제외 단면 */}
      <SectionCard title="제외 단면 (선택)">
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            분석에서 제외할 보의 단면명 <span className="text-gray-500">(쉼표 또는 줄바꿈으로 구분, 대소문자 무시, 시작 문자열 매칭)</span>
          </p>
          <input
            type="text"
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            placeholder="예: RB0, SB-"
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#669900] focus:outline-none focus:ring-2 focus:ring-[#669900]/40"
          />
          {excludeInput.trim() && (
            <p className="text-[11px] text-gray-500">
              제외 prefix: {excludeInput.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).map((p) => `"${p}"`).join(", ")}
            </p>
          )}
        </div>
      </SectionCard>

      {/* 스냅샷 저장/불러오기 */}
      <SectionCard title="스냅샷 (분석 결과 + 이름 저장)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 저장 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="스냅샷 이름 (예: 2F 초안)"
              className="flex-1 min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-[#669900] focus:outline-none focus:ring-2 focus:ring-[#669900]/40"
            />
            <Button
              size="sm"
              onClick={saveSnapshot}
              disabled={snapshotBusy || !response || !snapshotName.trim()}
              title={!response ? "먼저 분석을 실행하세요" : "현재 결과를 이 이름으로 저장"}
            >
              {snapshotBusy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              저장
            </Button>
          </div>
          {/* 불러오기 / 삭제 */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSnapshot}
              onChange={(e) => setSelectedSnapshot(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-[#669900] focus:outline-none focus:ring-2 focus:ring-[#669900]/40"
            >
              <option value="">— 저장된 스냅샷 선택 ({snapshots.length}) —</option>
              {snapshots.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} · {s.level_count}층 · {s.total_panels}패널 · {s.saved_at.slice(0, 16).replace("T", " ")}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={loadSnapshot}
              disabled={snapshotBusy || !selectedSnapshot}
            >
              <FolderOpen size={14} />
              불러오기
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteSnapshot}
              disabled={snapshotBusy || !selectedSnapshot}
              title="선택한 스냅샷 삭제"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* 슬래브 배근표 (분류 단위) */}
      <SectionCard title="슬래브 배근표 (분류 단위)">
        <SlabSectionsTable
          sections={sections}
          onChange={setSections}
          autoNames={autoNames}
        />
      </SectionCard>

      {/* 요약 */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="분석 층 수" value={summary.levels} />
            <SummaryCard label="총 패널" value={summary.total} />
            <SummaryCard label="1방향 / 2방향" value={`${summary.oneWay} / ${summary.twoWay}`} />
            <SummaryCard label="최대 경간" value={`${summary.maxSpan.toFixed(2)} m`} />
          </div>
          {summary.loadAreas > 0 && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/70 px-4 py-2 text-xs text-gray-400">
              MIDAS Floor Load 영역 <span className="text-gray-200 font-semibold">{summary.loadAreas}</span>개 조회됨 · 패널 매칭 <span className="text-[#8cbf2d] font-semibold">{summary.loadMatched}</span>/{summary.total}
            </div>
          )}
          {summary.loadAreas === 0 && (
            <div className="rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-4 py-2 text-xs text-yellow-300">
              MIDAS에서 Floor Load 영역(/db/FBLA)이 조회되지 않았습니다. 하중 매칭 정보가 비어있습니다.
            </div>
          )}
        </>
      )}

      {/* 층별 결과 */}
      {response?.reports.map((r) => {
        const selectedId = selectedPanelByLevel[r.z_level] ?? null;
        const hoverId = hoverPanelByLevel[r.z_level] ?? null;
        const displayedHiId = selectedId ?? hoverId;
        return (
          <LevelSection
            key={`${r.z_level}-${r.story_name}`}
            report={r}
            nameMap={nameMap}
            selectedId={selectedId}
            displayedHiId={displayedHiId}
            setSelectedByLevel={setSelectedPanelByLevel}
            setHoverByLevel={setHoverPanelByLevel}
            updateSlabName={updateSlabName}
            thkByName={thkByName}
          />
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}


interface LevelSectionProps {
  report: LevelReport;
  nameMap: Record<string, string>;
  selectedId: string | null;
  displayedHiId: string | null;
  setSelectedByLevel: React.Dispatch<
    React.SetStateAction<Record<number, string | null>>
  >;
  setHoverByLevel: React.Dispatch<
    React.SetStateAction<Record<number, string | null>>
  >;
  updateSlabName: (panelId: string, name: string) => void;
  thkByName: Record<string, number>;
}

function LevelSection({
  report: r,
  nameMap,
  selectedId,
  displayedHiId,
  setSelectedByLevel,
  setHoverByLevel,
  updateSlabName,
  thkByName,
}: LevelSectionProps) {
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const zLevel = r.z_level;

  // 왼쪽(이미지) 컬럼 높이 실시간 측정
  useEffect(() => {
    const el = leftColRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setLeftHeight(Math.floor(entry.contentRect.height));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 핸들러는 zLevel 과 setter 로만 만들어 참조 안정화 — renderers 재생성 방지
  const onForceSelectPanel = useCallback(
    (id: string) => {
      setSelectedByLevel((prev) => ({ ...prev, [zLevel]: id }));
    },
    [setSelectedByLevel, zLevel],
  );

  const onTogglePanel = useCallback(
    (id: string) => {
      setSelectedByLevel((prev) => ({
        ...prev,
        [zLevel]: prev[zLevel] === id ? null : id,
      }));
    },
    [setSelectedByLevel, zLevel],
  );

  const onHoverPanel = useCallback(
    (id: string | null) => {
      setHoverByLevel((prev) => ({ ...prev, [zLevel]: id }));
    },
    [setHoverByLevel, zLevel],
  );

  const renderers = useMemo<Record<string, CellRenderer>>(
    () => ({
      floor_load_name: FLOOR_LOAD_NAME_RENDERER,
      custom_name: (value, row) => {
        const panelId = String(row.panel_id ?? "");
        const currentName = String(value ?? "").trim();
        const thk = currentName ? thkByName[currentName] : undefined;
        return (
          <span className="inline-flex items-center gap-1">
            <input
              ref={(el) => {
                inputRefs.current[panelId] = el;
              }}
              type="text"
              value={String(value ?? "")}
              onChange={(e) => updateSlabName(panelId, e.target.value)}
              onFocus={() => onForceSelectPanel(panelId)}
              onClick={(e) => e.stopPropagation()}
              placeholder="예: S1"
              className="w-full min-w-[70px] rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white placeholder-gray-600 focus:border-[#669900] focus:outline-none focus:ring-1 focus:ring-[#669900]/50"
            />
            {thk != null && (
              <span
                className="whitespace-nowrap rounded bg-[#669900]/20 px-1.5 py-0.5 text-[10px] font-mono text-[#8cbf2d]"
                title={`배근표 등록 두께 ${thk}mm`}
              >
                t{thk}
              </span>
            )}
          </span>
        );
      },
    }),
    [updateSlabName, onForceSelectPanel, thkByName],
  );

  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const clickedId = String(row.panel_id ?? "");
      if (!clickedId) return;
      onTogglePanel(clickedId);
    },
    [onTogglePanel],
  );

  // 패널 클릭: 선택 토글 + 새로 선택된 경우 이름 입력 input 에 자동 포커스
  const handlePanelClick = useCallback(
    (id: string) => {
      const wasSelected = selectedIdRef.current === id;
      onTogglePanel(id);
      if (!wasSelected) {
        setTimeout(() => {
          const el = inputRefs.current[id];
          if (el) {
            el.focus();
            el.select();
          }
        }, 30);
      }
    },
    [onTogglePanel],
  );

  // 테이블 바디 최대 높이 = 이미지 영역 높이. 검색 입력(~40px) + 하단 카운트(~24px)
  // + 여백 정도를 빼서 실제 테이블 박스가 이미지와 얼추 같은 높이가 되도록.
  const tableBodyMax =
    leftHeight != null ? Math.max(200, leftHeight - 80) : undefined;

  return (
    <SectionCard
      title={`${r.story_name || `EL ${r.z_level.toFixed(2)} m`} — 패널 ${r.panel_count}개 (1방향 ${r.one_way_count} / 2방향 ${r.two_way_count}), 최대 경간 ${r.max_span.toFixed(2)} m`}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div ref={leftColRef} className="min-w-0 lg:col-span-2">
          <SlabPlanView
            beams={r.beams}
            panels={r.panels}
            highlightPanelId={displayedHiId}
            nameMap={nameMap}
            onPanelClick={handlePanelClick}
            onPanelHover={onHoverPanel}
          />
          <p className="mt-2 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1 align-middle">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "hsla(10,60%,55%,0.5)" }}></span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "hsla(120,60%,55%,0.5)" }}></span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "hsla(210,60%,55%,0.5)" }}></span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "hsla(290,60%,55%,0.5)" }}></span>
              <span className="ml-1">분류별 자동 색상</span>
            </span>
            <span className="inline-flex items-center ml-3 align-middle">
              <svg width="14" height="10" className="mr-1">
                <rect
                  x="1"
                  y="1"
                  width="12"
                  height="8"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
              </svg>
              분류 미지정
            </span>
            <span className="ml-3 text-gray-600">
              · 휠: 확대/축소 · 드래그: 이동 · 패널 클릭: 분류 입력
            </span>
          </p>
        </div>
        <div className="min-w-0">
          <DataTable
            columns={PANEL_COLUMNS}
            rows={r.panels.map((p) =>
              panelToRow(p, nameMap[p.panel_id] ?? ""),
            )}
            highlightKey="panel_id"
            highlightValue={selectedId}
            renderers={renderers}
            maxBodyHeight={tableBodyMax}
            onRowClick={handleRowClick}
          />
        </div>
      </div>
    </SectionCard>
  );
}
