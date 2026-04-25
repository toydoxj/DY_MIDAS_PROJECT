"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, FileText, Loader2, Play, RefreshCw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/ui/StatusMessage";
import DataTable, { type CellRenderer } from "@/components/DataTable";
import { BACKEND_URL } from "@/lib/types";
import type {
  LoadMapLevel,
  LoadMapResponse,
  LoadMapStory,
} from "./_lib/types";
import LoadMapView, { type LoadMapViewHandle } from "./_components/LoadMapView";

const AREA_COLUMNS = [
  { key: "fbld_name", label: "하중명" },
  { key: "dl", label: "DL (kN/㎡)" },
  { key: "ll", label: "LL (kN/㎡)" },
  { key: "factored", label: "Wu (kN/㎡)" },
];

export default function LoadMapPage() {
  const [stories, setStories] = useState<LoadMapStory[]>([]);
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [loadingStories, setLoadingStories] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [response, setResponse] = useState<LoadMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverFbldByLevel, setHoverFbldByLevel] = useState<Record<number, string | null>>({});
  const [shrinkMm, setShrinkMm] = useState<number>(300);
  const [distUnit, setDistUnit] = useState<string>("M");
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const viewRefs = useRef<Map<string, LoadMapViewHandle | null>>(new Map());
  const [gridSettings, setGridSettings] = useState<{
    angleDeg: number;
    origin: [number, number];
    xAxes: { label: string; offset: number }[];
    yAxes: { label: string; offset: number }[];
    extraGroups?: {
      name: string;
      angle_deg: number;
      origin: [number, number];
      axes: { label: string; offset: number }[];
      color: string;
    }[];
    unitFactor: number;
  } | null>(null);

  // MIDAS DIST 단위 + Project Settings 의 축렬 정보 함께 로드
  useEffect(() => {
    const MM_TO: Record<string, number> = {
      MM: 1, CM: 0.1, M: 0.001, IN: 0.0393701, FT: 0.00328084,
    };
    Promise.all([
      fetch(`${BACKEND_URL}/api/loadcase/load-map/unit`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BACKEND_URL}/api/project-settings/grid`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([unitData, gridData]) => {
        let dist = "M";
        const raw = unitData?.raw ?? {};
        const u = raw.UNIT ?? raw;
        let inner = u;
        if (inner && typeof inner === "object" && !("DIST" in inner)) {
          const first = Object.values(inner)[0];
          if (first && typeof first === "object") inner = first;
        }
        if (inner?.DIST) dist = String(inner.DIST).toUpperCase();
        setDistUnit(dist);
        const unitFactor = MM_TO[dist] ?? 0.001;
        if (gridData) {
          setGridSettings({
            angleDeg: gridData.angle_deg ?? 0,
            origin: gridData.origin ?? [0, 0],
            xAxes: gridData.x_axes ?? [],
            yAxes: gridData.y_axes ?? [],
            extraGroups: gridData.extra_groups ?? [],
            unitFactor,
          });
        }
      })
      .catch(() => {});
  }, []);

  // mm → 현재 DIST 단위로 변환 (월드 좌표계의 inset 거리)
  const insetDistance = useMemo(() => {
    const MM_TO: Record<string, number> = {
      MM: 1,
      CM: 0.1,
      M: 0.001,
      IN: 0.0393701,
      FT: 0.00328084,
    };
    return shrinkMm * (MM_TO[distUnit] ?? 1);
  }, [shrinkMm, distUnit]);

  const refreshCache = useCallback(async () => {
    setLoadingStories(true);
    setError(null);
    try {
      const refresh = await fetch(`${BACKEND_URL}/api/midas/refresh-cache`, {
        method: "POST",
      });
      if (!refresh.ok) throw new Error(`캐시 무효화 실패 (${refresh.status})`);
      // 이어서 층 목록 재조회
      const res = await fetch(`${BACKEND_URL}/api/member/slab-span/stories`);
      if (!res.ok) throw new Error(`층 목록 조회 실패 (${res.status})`);
      const data: LoadMapStory[] = await res.json();
      setStories(data);
      setSelectedStories(new Set(data.map((s) => s.name)));
      setResponse(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingStories(false);
    }
  }, []);

  const loadStories = useCallback(async () => {
    setLoadingStories(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/member/slab-span/stories`);
      if (!res.ok) throw new Error(`층 목록 조회 실패 (${res.status})`);
      const data: LoadMapStory[] = await res.json();
      setStories(data);
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
      const body = {
        story_names: selectedStories.size > 0 ? Array.from(selectedStories) : null,
      };
      const res = await fetch(`${BACKEND_URL}/api/loadcase/load-map/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `분석 실패 (${res.status})`);
      }
      const data: LoadMapResponse = await res.json();
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }, [selectedStories]);

  const handleExport = useCallback(
    async (kind: "pdf" | "dxf", key: string, storyName: string) => {
      const handle = viewRefs.current.get(key);
      if (!handle) {
        setError("해당 층의 뷰가 아직 마운트되지 않았습니다");
        return;
      }
      setExportingKey(`${key}-${kind}`);
      setError(null);
      try {
        if (kind === "pdf") {
          await handle.exportPdf(storyName);
        } else {
          // DXF 도 화면의 shrink 슬라이더 값을 그대로 적용 (mm)
          await handle.exportDxf(storyName, shrinkMm);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setExportingKey(null);
      }
    },
    [shrinkMm],
  );

  const summary = useMemo(() => {
    if (!response) return null;
    const totalAreas = response.total_area_count;
    const maxWu = Math.max(
      0,
      ...response.reports.flatMap((r) => r.load_areas.map((a) => a.factored)),
    );
    return {
      levels: response.level_count,
      totalAreas,
      maxWu,
    };
  }, [response]);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Floor Load Map"
        subtitle="층별 프레임 + 입력된 Floor Load 영역 시각화"
        backHref="/loadcase"
      />

      {error && <AlertBanner type="error" message={error} />}

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
            <Button
              size="sm"
              variant="outline"
              onClick={refreshCache}
              disabled={loadingStories}
              title="MIDAS 모델 파일을 바꾼 경우 캐시를 비우고 다시 읽기"
            >
              <RefreshCw size={14} />
              모델 다시 읽기
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
          <p className="text-sm text-gray-400">
            층(/db/STOR) 데이터가 없습니다. MIDAS 연결 상태를 확인하세요.
          </p>
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

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard label="분석 층 수" value={summary.levels} />
            <SummaryCard label="총 하중 영역" value={summary.totalAreas} />
            <SummaryCard label="최대 Wu" value={`${summary.maxWu.toFixed(2)} kN/㎡`} />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5">
            <span className="text-sm font-medium text-gray-100 whitespace-nowrap">
              영역 수축
            </span>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={shrinkMm}
              onChange={(e) => setShrinkMm(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #8cbf2d 0%, #8cbf2d ${(Math.min(shrinkMm, 500) / 500) * 100}%, #4b5563 ${(Math.min(shrinkMm, 500) / 500) * 100}%, #4b5563 100%)`,
              }}
              className="flex-1 h-2 appearance-none rounded-full cursor-pointer accent-[#8cbf2d] outline-none
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8cbf2d]
                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab
                [&::-webkit-slider-thumb]:active:cursor-grabbing
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#8cbf2d]
                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white
                [&::-moz-range-thumb]:cursor-grab"
            />
            <input
              type="number"
              min={0}
              max={5000}
              step={10}
              value={shrinkMm}
              onChange={(e) => setShrinkMm(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded border border-gray-500 bg-gray-700 px-2 py-1 text-right text-sm font-mono font-semibold text-white focus:border-[#8cbf2d] focus:outline-none focus:ring-2 focus:ring-[#8cbf2d]/40"
            />
            <span className="text-sm font-medium text-gray-200 whitespace-nowrap">
              mm
            </span>
            <span className="text-xs text-gray-300 whitespace-nowrap font-mono">
              모델: <span className="font-semibold text-[#8cbf2d]">{distUnit}</span>
            </span>
            <button
              type="button"
              onClick={() => setShrinkMm(0)}
              className="rounded border border-gray-500 bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-100 hover:bg-gray-600 hover:border-gray-400 transition whitespace-nowrap"
              title="원본 (0mm)"
            >
              리셋
            </button>
          </div>
        </>
      )}

      {response?.reports.map((r) => {
        const hoverFbld = hoverFbldByLevel[r.z_level] ?? null;
        const key = `${r.z_level}-${r.story_name}`;
        const storyLabel = r.story_name || `EL ${r.z_level.toFixed(2)} m`;
        const pdfBusy = exportingKey === `${key}-pdf`;
        const dxfBusy = exportingKey === `${key}-dxf`;
        return (
          <SectionCard
            key={key}
            title={`${storyLabel} — 하중 영역 ${r.load_areas.length}개 · 보 ${r.beams.length}개`}
            action={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport("pdf", key, r.story_name)}
                  disabled={pdfBusy || dxfBusy}
                  title="현재 화면(zoom/pan 그대로) 을 PDF 로 저장"
                >
                  {pdfBusy ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport("dxf", key, r.story_name)}
                  disabled={pdfBusy || dxfBusy}
                  title="FBLA 영역 다각형을 DXF 로 저장 (mm 단위, 레이어 분리)"
                >
                  {dxfBusy ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                  DXF
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <LoadMapView
                  ref={(handle) => {
                    if (handle) viewRefs.current.set(key, handle);
                    else viewRefs.current.delete(key);
                  }}
                  beams={r.beams}
                  areas={r.load_areas}
                  highlightFbld={hoverFbld}
                  insetDistance={insetDistance}
                  grid={gridSettings}
                  onAreaHover={(id) =>
                    setHoverFbldByLevel((prev) => ({ ...prev, [r.z_level]: id }))
                  }
                />
                <p className="mt-2 text-[11px] text-gray-500">
                  휠: 확대/축소 · 드래그: 이동 · 영역 호버: 하이라이트 · 이름별 자동 색상
                </p>
              </div>
              <div className="min-w-0">
                <LoadTable level={r} highlightFbld={hoverFbld} />
              </div>
            </div>
          </SectionCard>
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

const LOAD_NAME_RENDERER: CellRenderer = (value, row) => {
  const count = Number(row._count ?? 1);
  const name = String(value ?? "");
  return count > 1 ? (
    <span>
      {name}
      <span className="ml-1 text-[11px] text-gray-400 font-mono">×{count}</span>
    </span>
  ) : (
    <span>{name}</span>
  );
};

function LoadTable({
  level,
  highlightFbld,
}: {
  level: LoadMapLevel;
  highlightFbld: string | null;
}) {
  // 같은 하중명 영역을 그룹핑 — 동일 FBLD 참조이므로 DL/LL/Wu 값은 같음.
  // 개수만 집계하고, 대표 Wu 내림차순 정렬.
  const rows = useMemo(() => {
    type Group = {
      fbld_name: string;
      dl: number;
      ll: number;
      factored: number;
      count: number;
    };
    const map = new Map<string, Group>();
    for (const a of level.load_areas) {
      const key = a.fbld_name || "(이름없음)";
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          fbld_name: key,
          dl: a.dl,
          ll: a.ll,
          factored: a.factored,
          count: 1,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.factored - a.factored || a.fbld_name.localeCompare(b.fbld_name))
      .map((g) => ({
        fbld_name: g.fbld_name,
        dl: g.dl.toFixed(2),
        ll: g.ll.toFixed(2),
        factored: g.factored.toFixed(2),
        _count: g.count,
      }));
  }, [level.load_areas]);

  const renderers = useMemo<Record<string, CellRenderer>>(
    () => ({ fbld_name: LOAD_NAME_RENDERER }),
    [],
  );

  return (
    <DataTable
      columns={AREA_COLUMNS}
      rows={rows}
      highlightKey="fbld_name"
      highlightValue={highlightFbld}
      renderers={renderers}
    />
  );
}
