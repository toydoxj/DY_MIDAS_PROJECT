"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { BeamSegment, Panel } from "../_lib/types";

interface Props {
  beams: BeamSegment[];
  panels: Panel[];
  highlightPanelId?: string | null;
  onPanelClick?: (id: string) => void;
  onPanelHover?: (id: string | null) => void;
  /** panel_id → 사용자 지정 슬래브 이름 매핑. 없으면 "(미지정)"으로 표시. */
  nameMap?: Record<string, string>;
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
          {/* 패널 박스 (보보다 아래 레이어) */}
          {panels.map((p) => {
            const isHi = p.panel_id === highlightPanelId;
            const customName = nameMap?.[p.panel_id]?.trim() ?? "";
            const isUnnamed = customName.length === 0;
            const nameColors = colorForName(customName);
            const stroke = isHi ? COLORS.selectedStroke : nameColors.stroke;
            const fill = isHi ? COLORS.selectedFill : nameColors.fill;
            // 미지정 패널: 점선 테두리로 "미입력" 상태를 한눈에 표시
            const dashLen = Math.max(strokeW * 4, Math.min(p.lx, p.ly) * 0.04);
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
                <rect
                  x={p.x_min}
                  y={p.y_min}
                  width={p.lx}
                  height={p.ly}
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

          {/* 보 라인 */}
          {beams.map((b, i) => (
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
        </g>

        {/* 라벨 레이어: 이름 / 경간(굵게 강조) / 하중명 / 하중값 — 4줄 */}
        <g pointerEvents="none">
          {panels.map((p) => {
            const cx = (p.x_min + p.x_max) / 2;
            const cy = Ty - (p.y_min + p.y_max) / 2;
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
