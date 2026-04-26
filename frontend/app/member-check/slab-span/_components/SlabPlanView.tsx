"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { BeamSegment, Panel } from "../_lib/types";
import GridAxesOverlay, { GridAxesBubbles } from "@/components/GridAxesOverlay";

interface Props {
  beams: BeamSegment[];
  panels: Panel[];
  highlightPanelId?: string | null;
  onPanelClick?: (id: string) => void;
  onPanelHover?: (id: string | null) => void;
  /** panel_id → 사용자 지정 슬래브 이름 매핑. 없으면 "(미지정)"으로 표시. */
  nameMap?: Record<string, string>;
  /** 축렬 오버레이 (Project Setting). offset/origin 은 mm 단위. */
  grid?: {
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
    /** mm → 모델 단위 변환 계수 (DIST=M 이면 0.001, MM 이면 1). */
    unitFactor: number;
  } | null;
  /** 지정 시 고정 높이 사용 (px). 미지정이면 평면 비율에 따라 자동 조정. */
  height?: number;
  /** 자동 높이 모드의 하한 (px). */
  minHeight?: number;
  /** 자동 높이 모드의 상한 (px). */
  maxHeight?: number;
}

const COLORS = {
  unnamedFill: "rgba(156,163,175,0.10)",
  unnamedStroke: "#6b7280",
  selectedFill: "rgba(245,158,11,0.32)",
  selectedStroke: "#f59e0b",
  beam: "#9ca3af",
  text: "#e5e7eb",
  textSub: "#9ca3af",
};

/**
 * 공유 끝점 기반 polyline 체인 빌더. 꺾이는 체인도 하나의 polyline 으로.
 * LoadMapView 와 동일 로직 — 향후 공용 훅으로 추출 고려.
 */
function buildChains(
  segs: { x1: number; y1: number; x2: number; y2: number }[],
  tol: number,
): [number, number][][] {
  if (segs.length === 0) return [];
  const snap = (v: number) => Math.round(v / tol) * tol;
  const keyOf = (x: number, y: number) => `${snap(x)},${snap(y)}`;
  interface Adj {
    otherKey: string;
    other: [number, number];
    segIdx: number;
  }
  const adj = new Map<string, Adj[]>();
  const coordOf = new Map<string, [number, number]>();
  segs.forEach((s, i) => {
    const a = keyOf(s.x1, s.y1);
    const b = keyOf(s.x2, s.y2);
    if (!coordOf.has(a)) coordOf.set(a, [s.x1, s.y1]);
    if (!coordOf.has(b)) coordOf.set(b, [s.x2, s.y2]);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ otherKey: b, other: [s.x2, s.y2], segIdx: i });
    adj.get(b)!.push({ otherKey: a, other: [s.x1, s.y1], segIdx: i });
  });
  const visited = new Set<number>();
  const chains: [number, number][][] = [];
  const walk = (startKey: string, firstSegIdx: number) => {
    if (visited.has(firstSegIdx)) return;
    const startCoord = coordOf.get(startKey)!;
    const chain: [number, number][] = [startCoord];
    let curKey = startKey;
    let curSegIdx = firstSegIdx;
    while (true) {
      if (visited.has(curSegIdx)) break;
      visited.add(curSegIdx);
      const segMeta = adj.get(curKey)!.find((a) => a.segIdx === curSegIdx)!;
      const nextKey = segMeta.otherKey;
      chain.push(segMeta.other);
      const nextAdj = adj.get(nextKey) || [];
      if (nextAdj.length !== 2) break;
      const nxt = nextAdj.find((n) => !visited.has(n.segIdx));
      if (!nxt) break;
      curKey = nextKey;
      curSegIdx = nxt.segIdx;
    }
    if (chain.length >= 2) chains.push(chain);
  };
  for (const [key, neighbors] of adj.entries()) {
    if (neighbors.length === 2) continue;
    for (const nb of neighbors) walk(key, nb.segIdx);
  }
  segs.forEach((_, i) => {
    if (visited.has(i)) return;
    const s = segs[i];
    const k = keyOf(s.x1, s.y1);
    walk(k, i);
  });
  return chains;
}

/** 문자열 → 32bit 해시. djb2 + Murmur 스타일 bit mixing. */
function hash32(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  // bit mixing — "RS1" vs "RS2" 같이 1글자만 다른 입력도 크게 분산시킴
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = h ^ (h >>> 16);
  return h;
}

/** 슬래브 분류(S) 문자열에 대응하는 HSL 기반 fill/stroke 쌍.
 *
 * Hue 는 해시를 황금각(137.508°) 배수로 돌려 인접 해시값도 색상이 크게 달라지도록.
 * 채도/명도도 살짝 변주하여 Hue 가 비슷해도 구분감을 높인다.
 */
function colorForName(name: string): { fill: string; stroke: string } {
  if (!name) {
    return { fill: COLORS.unnamedFill, stroke: COLORS.unnamedStroke };
  }
  const h = hash32(name);
  const hue = (Math.abs(h) * 137.508) % 360;
  const sat = 55 + (Math.abs(h >> 8) % 20);        // 55~74
  const light = 52 + (Math.abs(h >> 16) % 12);      // 52~63
  return {
    fill: `hsla(${hue.toFixed(1)}, ${sat}%, ${light}%, 0.26)`,
    stroke: `hsl(${hue.toFixed(1)}, ${Math.min(sat + 10, 90)}%, ${light + 8}%)`,
  };
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 50;
const ZOOM_STEP = 1.25;

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function SlabPlanView({
  beams,
  panels,
  highlightPanelId,
  onPanelClick,
  onPanelHover,
  nameMap,
  grid,
  height,
  minHeight = 320,
  maxHeight = 900,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    beams.forEach((b) => {
      xs.push(b.x1, b.x2);
      ys.push(b.y1, b.y2);
    });
    panels.forEach((p) => {
      xs.push(p.x_min, p.x_max);
      ys.push(p.y_min, p.y_max);
    });
    if (xs.length === 0 || ys.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    }
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [beams, panels]);

  const baseView = useMemo<ViewBox>(() => {
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const margin = Math.max(w, h, 1) * 0.08;
    return {
      x: bounds.minX - margin,
      y: bounds.minY - margin,
      w: w + margin * 2,
      h: h + margin * 2,
    };
  }, [bounds]);

  // 데이터 좌표 Y 반전을 위한 transform 원점 (baseView 기준 고정)
  const Ty = baseView.y * 2 + baseView.h;
  const transform = `translate(0, ${Ty}) scale(1, -1)`;

  const [view, setView] = useState<ViewBox | null>(null);
  const activeView = view ?? baseView;

  // 데이터가 바뀌면 뷰 초기화
  useEffect(() => {
    setView(null);
  }, [baseView.x, baseView.y, baseView.w, baseView.h]);

  const fontSize = Math.max(Math.min(activeView.w, activeView.h) * 0.02, 0.12);
  const strokeW = Math.min(activeView.w, activeView.h) * 0.003;

  const clampScaleView = useCallback(
    (nextView: ViewBox): ViewBox => {
      const scale = baseView.w / nextView.w;
      if (scale < MIN_SCALE) {
        const newW = baseView.w / MIN_SCALE;
        const newH = baseView.h / MIN_SCALE;
        return {
          x: nextView.x + (nextView.w - newW) / 2,
          y: nextView.y + (nextView.h - newH) / 2,
          w: newW,
          h: newH,
        };
      }
      if (scale > MAX_SCALE) {
        const newW = baseView.w / MAX_SCALE;
        const newH = baseView.h / MAX_SCALE;
        return {
          x: nextView.x + (nextView.w - newW) / 2,
          y: nextView.y + (nextView.h - newH) / 2,
          w: newW,
          h: newH,
        };
      }
      return nextView;
    },
    [baseView],
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: activeView.x, y: activeView.y };
      const rect = svg.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      return {
        x: activeView.x + relX * activeView.w,
        y: activeView.y + relY * activeView.h,
      };
    },
    [activeView],
  );

  // React 의 onWheel 은 passive 리스너로 등록되어 preventDefault 가 무시됨.
  // 페이지 스크롤을 막기 위해 네이티브 리스너를 {passive: false} 로 직접 등록.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const blockScroll = (e: WheelEvent) => e.preventDefault();
    svg.addEventListener("wheel", blockScroll, { passive: false });
    return () => svg.removeEventListener("wheel", blockScroll);
  }, []);

  // 휠 줌 (커서 위치 기준)
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const factor = e.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      const anchor = screenToWorld(e.clientX, e.clientY);
      const newW = activeView.w * factor;
      const newH = activeView.h * factor;
      const relX = (anchor.x - activeView.x) / activeView.w;
      const relY = (anchor.y - activeView.y) / activeView.h;
      const next = {
        x: anchor.x - relX * newW,
        y: anchor.y - relY * newH,
        w: newW,
        h: newH,
      };
      setView(clampScaleView(next));
    },
    [activeView, clampScaleView, screenToWorld],
  );

  // 드래그 팬
  const panStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startView: ViewBox;
    moved: boolean;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      panStateRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startView: activeView,
        moved: false,
      };
    },
    [activeView],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const st = panStateRef.current;
      if (!st) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxWorld = ((e.clientX - st.startClientX) / rect.width) * st.startView.w;
      const dyWorld = ((e.clientY - st.startClientY) / rect.height) * st.startView.h;
      if (Math.hypot(e.clientX - st.startClientX, e.clientY - st.startClientY) > 3) {
        st.moved = true;
      }
      setView({
        x: st.startView.x - dxWorld,
        y: st.startView.y - dyWorld,
        w: st.startView.w,
        h: st.startView.h,
      });
    },
    [],
  );

  const endPan = useCallback(() => {
    panStateRef.current = null;
  }, []);

  // 패널 클릭 — 드래그로 인한 의도치 않은 클릭은 무시
  const handlePanelClick = (id: string) => {
    if (panStateRef.current?.moved) return;
    onPanelClick?.(id);
  };

  const zoomAtCenter = (factor: number) => {
    const cx = activeView.x + activeView.w / 2;
    const cy = activeView.y + activeView.h / 2;
    const newW = activeView.w * factor;
    const newH = activeView.h * factor;
    setView(
      clampScaleView({
        x: cx - newW / 2,
        y: cy - newH / 2,
        w: newW,
        h: newH,
      }),
    );
  };

  if (panels.length === 0 && beams.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500">
        분석된 보/패널이 없습니다
      </div>
    );
  }

  const scalePercent = Math.round((baseView.w / activeView.w) * 100);

  // height 가 명시되면 고정, 아니면 평면 비율에 맞춘 aspect-ratio + min/max 제한
  const wrapperStyle: React.CSSProperties =
    height !== undefined
      ? { height }
      : {
          aspectRatio: `${baseView.w} / ${baseView.h}`,
          minHeight,
          maxHeight,
        };

  return (
    <div className="relative w-full" style={wrapperStyle}>
      <svg
        ref={svgRef}
        viewBox={`${activeView.x} ${activeView.y} ${activeView.w} ${activeView.h}`}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "#111827",
          borderRadius: 8,
          cursor: panStateRef.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        <g transform={transform}>
          {/* 축렬 오버레이 — 보/패널보다 아래 레이어, 점선 파란색 */}
          {grid && (grid.xAxes.length > 0 || grid.yAxes.length > 0) && (
            <GridAxesOverlay
              angleDeg={grid.angleDeg}
              origin={grid.origin}
              xAxes={grid.xAxes}
              yAxes={grid.yAxes}
              bbox={bounds}
              strokeW={strokeW}
              unitFactor={grid.unitFactor}
            />
          )}
          {/* 추가 축렬 그룹 — 각 그룹은 자체 angle/color 로 단일 방향 축렬 */}
          {grid?.extraGroups?.map((g, i) => (
            <GridAxesOverlay
              key={`extra-${i}`}
              angleDeg={g.angle_deg}
              origin={g.origin}
              xAxes={g.axes}
              yAxes={[]}
              bbox={bounds}
              strokeW={strokeW}
              color={g.color}
              unitFactor={grid.unitFactor}
            />
          ))}
          {/* 패널 — polygon 렌더 (삼각형/사각형/오각형 모두 지원).
              polygon 이 비어있으면 AABB 사각형 fallback */}
          {panels.map((p) => {
            const isHi = p.panel_id === highlightPanelId;
            const customName = nameMap?.[p.panel_id]?.trim() ?? "";
            const isUnnamed = customName.length === 0;
            const nameColors = colorForName(customName);
            const stroke = isHi ? COLORS.selectedStroke : nameColors.stroke;
            const fill = isHi ? COLORS.selectedFill : nameColors.fill;
            const dashLen = Math.max(strokeW * 4, Math.min(p.lx, p.ly) * 0.04);
            const pts =
              p.polygon && p.polygon.length >= 3
                ? p.polygon.map(([x, y]) => `${x},${y}`).join(" ")
                : `${p.x_min},${p.y_min} ${p.x_max},${p.y_min} ${p.x_max},${p.y_max} ${p.x_min},${p.y_max}`;
            return (
              <g
                key={p.panel_id}
                style={{ cursor: onPanelClick ? "pointer" : "default" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePanelClick(p.panel_id);
                }}
                onMouseEnter={() => onPanelHover?.(p.panel_id)}
                onMouseLeave={() => onPanelHover?.(null)}
              >
                <polygon
                  points={pts}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHi ? strokeW * 2.2 : strokeW * 1.2}
                  strokeDasharray={
                    isUnnamed && !isHi ? `${dashLen} ${dashLen * 0.6}` : undefined
                  }
                  opacity={isUnnamed && !isHi ? 0.75 : 1}
                />
              </g>
            );
          })}

          {/* OMBB 오버레이 — 선택된 패널만 주황색 점선 사각형 */}
          {(() => {
            const selPanel = panels.find((p) => p.panel_id === highlightPanelId);
            if (!selPanel || !selPanel.ombb_vertices || selPanel.ombb_vertices.length < 4) {
              return null;
            }
            const ombbPts = selPanel.ombb_vertices
              .map(([x, y]) => `${x},${y}`)
              .join(" ");
            return (
              <polygon
                points={ombbPts}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={strokeW * 1.3}
                strokeDasharray={`${strokeW * 3} ${strokeW * 2}`}
                pointerEvents="none"
              />
            );
          })()}

          {/* 보 라인 — SKEW 는 공유 끝점 polyline 으로 묶어 꺾임 자연스럽게 */}
          {(() => {
            const axisBeams = beams.filter((b) => b.direction !== "SKEW");
            const skewBeams = beams.filter((b) => b.direction === "SKEW");
            const chainTol = Math.max(strokeW * 0.5, 1e-3);
            const skewChains = buildChains(skewBeams, chainTol);
            return (
              <>
                {skewChains.map((chain, i) => (
                  <polyline
                    key={`skew-chain-${i}`}
                    points={chain.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="none"
                    stroke={COLORS.beam}
                    strokeWidth={strokeW * 1.6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                ))}
                {axisBeams.map((b, i) => (
                  <line
                    key={`${b.elem_id}-${i}`}
                    x1={b.x1}
                    y1={b.y1}
                    x2={b.x2}
                    y2={b.y2}
                    stroke={COLORS.beam}
                    strokeWidth={strokeW * 1.6}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                ))}
              </>
            );
          })()}
        </g>

        {/* 축렬 버블 — transform 밖에서 Ty 수동 반전으로 텍스트 똑바로 */}
        {grid && (grid.xAxes.length > 0 || grid.yAxes.length > 0) && (
          <GridAxesBubbles
            angleDeg={grid.angleDeg}
            origin={grid.origin}
            xAxes={grid.xAxes}
            yAxes={grid.yAxes}
            bbox={bounds}
            strokeW={strokeW}
            Ty={Ty}
            unitFactor={grid.unitFactor}
          />
        )}
        {grid?.extraGroups?.map((g, i) => (
          <GridAxesBubbles
            key={`extra-bubble-${i}`}
            angleDeg={g.angle_deg}
            origin={g.origin}
            xAxes={g.axes}
            yAxes={[]}
            bbox={bounds}
            strokeW={strokeW}
            Ty={Ty}
            color={g.color}
            unitFactor={grid?.unitFactor ?? 1}
          />
        ))}

        {/* 라벨 레이어: 이름 / 경간(굵게 강조) / 하중명 / 하중값 — 4줄
            polygon centroid 기반으로 삼각형/오각형에서도 중앙 배치 */}
        <g pointerEvents="none">
          {panels.map((p) => {
            let wcx: number, wcy: number;
            if (p.polygon && p.polygon.length >= 3) {
              // Shoelace centroid
              let a2 = 0;
              let sx = 0;
              let sy = 0;
              const n = p.polygon.length;
              for (let i = 0; i < n; i++) {
                const [x1, y1] = p.polygon[i];
                const [x2, y2] = p.polygon[(i + 1) % n];
                const cross = x1 * y2 - x2 * y1;
                a2 += cross;
                sx += (x1 + x2) * cross;
                sy += (y1 + y2) * cross;
              }
              if (Math.abs(a2) > 1e-9) {
                wcx = sx / (3 * a2);
                wcy = sy / (3 * a2);
              } else {
                wcx = p.polygon.reduce((a, pt) => a + pt[0], 0) / n;
                wcy = p.polygon.reduce((a, pt) => a + pt[1], 0) / n;
              }
            } else {
              wcx = (p.x_min + p.x_max) / 2;
              wcy = (p.y_min + p.y_max) / 2;
            }
            const cx = wcx;
            const cy = Ty - wcy;
            const customName = nameMap?.[p.panel_id]?.trim() ?? "";
            const isUnnamed = customName.length === 0;
            const nameLabel = isUnnamed ? "(미지정)" : customName;
            const nameDisplaySize = fontSize * (isUnnamed ? 0.85 : 1.0);
            const nameColor = isUnnamed ? "#9ca3af" : COLORS.text;
            const nameStyle = isUnnamed
              ? { fontStyle: "italic" as const }
              : undefined;
            const spanLabel = `${p.short_span.toFixed(2)}m`;
            const hasLoad = p.floor_load_factored != null;
            const loadName = (p.floor_load_name ?? "").trim();
            const loadNameLabel = hasLoad ? (loadName || "–") : "하중 –";
            const loadValueLabel = hasLoad
              ? p.floor_load_factored!.toFixed(2)
              : "";
            const spanSize = fontSize * 1.05;
            const nameSize = fontSize * 0.85;
            const loadSize = fontSize * 0.78;
            const loadColor = hasLoad ? "#fbbf24" : "#6b7280";
            return (
              <g key={`lbl-${p.panel_id}`}>
                {/* 1. 슬래브 분류(S) — 지정되면 도면처럼 크고 굵게 */}
                <text
                  x={cx}
                  y={cy - spanSize * 1.45}
                  fontSize={nameDisplaySize}
                  fill={nameColor}
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontWeight={isUnnamed ? 400 : 700}
                  style={nameStyle}
                >
                  {nameLabel}
                </text>
                {/* 2. 경간(단변) — 굵게, 가장 크게 */}
                <text
                  x={cx}
                  y={cy - spanSize * 0.3}
                  fontSize={spanSize}
                  fill={COLORS.text}
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontWeight={800}
                >
                  {spanLabel}
                </text>
                {/* 3. 하중 이름 */}
                <text
                  x={cx}
                  y={cy + spanSize * 0.75}
                  fontSize={loadSize}
                  fill={loadColor}
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontWeight={hasLoad ? 600 : 400}
                >
                  {loadNameLabel}
                </text>
                {/* 4. 하중 값 (Wu 접두어 없이 숫자만) */}
                {hasLoad && (
                  <text
                    x={cx}
                    y={cy + spanSize * 1.7}
                    fontSize={loadSize}
                    fill={loadColor}
                    textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontWeight={700}
                  >
                    {loadValueLabel}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* 확대/축소 컨트롤 */}
      <div className="absolute right-2 top-2 flex flex-col gap-1 rounded-lg bg-gray-900/80 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => zoomAtCenter(1 / ZOOM_STEP)}
          title="확대 (Ctrl + 휠 업)"
          className="rounded p-1.5 text-gray-300 hover:bg-gray-700 hover:text-white transition"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => zoomAtCenter(ZOOM_STEP)}
          title="축소"
          className="rounded p-1.5 text-gray-300 hover:bg-gray-700 hover:text-white transition"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => setView(null)}
          title="원래 크기로"
          className="rounded p-1.5 text-gray-300 hover:bg-gray-700 hover:text-white transition"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* 현재 배율 */}
      <div className="absolute left-2 top-2 rounded bg-gray-900/70 px-2 py-0.5 text-[10px] text-gray-400 backdrop-blur">
        {scalePercent}%
      </div>

      {/* 축 범위 */}
      <div className="absolute bottom-2 left-2 rounded bg-gray-900/70 px-2 py-0.5 text-[10px] text-gray-500 backdrop-blur font-mono">
        X: {bounds.minX.toFixed(1)}~{bounds.maxX.toFixed(1)}m · Y: {bounds.minY.toFixed(1)}~{bounds.maxY.toFixed(1)}m
      </div>
    </div>
  );
}
