"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { LoadMapArea, LoadMapBeam } from "../_lib/types";
import GridAxesOverlay, { GridAxesBubbles } from "@/components/GridAxesOverlay";
import { BACKEND_URL } from "@/lib/types";

interface Props {
  beams: LoadMapBeam[];
  areas: LoadMapArea[];
  highlightFbld?: string | null;
  onAreaHover?: (fbld: string | null) => void;
  onAreaClick?: (fbld: string) => void;
  minHeight?: number;
  maxHeight?: number;
  /** 각 변을 내부 법선 방향으로 밀어 넣을 거리 (월드 좌표 단위). */
  insetDistance?: number;
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
    /** mm → 모델 단위 변환 계수 */
    unitFactor: number;
  } | null;
}

const COLORS = {
  beam: "#9ca3af",
  beamHi: "#f59e0b",
  areaStroke: "#6b7280",
  selectedStroke: "#f59e0b",
  selectedFill: "rgba(245,158,11,0.35)",
  text: "#f3f4f6",
  textSub: "#9ca3af",
};

const MIN_SCALE = 0.3;
const MAX_SCALE = 50;
const ZOOM_STEP = 1.25;

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 하중명 해시 기반 색상 (SlabPlanView 와 동일 규칙 — 동일 명은 동일 색). */
function hash32(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = h ^ (h >>> 16);
  return h;
}

function colorForLoad(name: string): { fill: string; stroke: string } {
  if (!name) {
    return { fill: "rgba(156,163,175,0.15)", stroke: COLORS.areaStroke };
  }
  const h = hash32(name);
  const hue = (Math.abs(h) * 137.508) % 360;
  const sat = 58 + (Math.abs(h >> 8) % 22);
  const light = 50 + (Math.abs(h >> 16) % 14);
  return {
    fill: `hsla(${hue.toFixed(1)}, ${sat}%, ${light}%, 0.35)`,
    stroke: `hsl(${hue.toFixed(1)}, ${Math.min(sat + 10, 90)}%, ${light + 10}%)`,
  };
}

/**
 * 공유 끝점 기반 polyline 체인 빌더.
 * 같은 (tolerance 내) 좌표를 끝점으로 공유하는 세그먼트들을 순차 연결해
 * `<polyline>` points 배열로 변환. 꺾이는 체인도 하나의 polyline 으로.
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

  // degree ≠ 2 (체인 끝/분기점) 노드에서부터 경로 추적
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
      // 분기점 또는 체인 끝이면 멈춤
      if (nextAdj.length !== 2) break;
      const nxt = nextAdj.find((n) => !visited.has(n.segIdx));
      if (!nxt) break;
      curKey = nextKey;
      curSegIdx = nxt.segIdx;
    }
    if (chain.length >= 2) chains.push(chain);
  };

  // 1) degree ≠ 2 노드에서 출발
  for (const [key, neighbors] of adj.entries()) {
    if (neighbors.length === 2) continue;
    for (const nb of neighbors) walk(key, nb.segIdx);
  }
  // 2) 모든 노드 degree=2 인 폐곡선 처리
  segs.forEach((_, i) => {
    if (visited.has(i)) return;
    // 임의 시작점
    const s = segs[i];
    const k = keyOf(s.x1, s.y1);
    walk(k, i);
  });

  return chains;
}

function polygonCentroid(poly: [number, number][]): [number, number] {
  if (poly.length === 0) return [0, 0];
  let cx = 0;
  let cy = 0;
  let area2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cross = x1 * y2 - x2 * y1;
    area2 += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area2) < 1e-9) {
    const sx = poly.reduce((a, p) => a + p[0], 0);
    const sy = poly.reduce((a, p) => a + p[1], 0);
    return [sx / poly.length, sy / poly.length];
  }
  const a = area2 * 3;
  return [cx / a, cy / a];
}

/** Shoelace 공식으로 부호 있는 면적 (CCW=양수, CW=음수). */
function signedArea(poly: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** 두 직선 (p1 + t*d1) 과 (p2 + s*d2) 의 교차점. 평행이면 null. */
function lineIntersect(
  p1: [number, number],
  d1: [number, number],
  p2: [number, number],
  d2: [number, number],
): [number, number] | null {
  const det = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(det) < 1e-12) return null;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const t = (dx * d2[1] - dy * d2[0]) / det;
  return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}

/**
 * 다각형을 내부로 `d` 만큼 오프셋(inset).
 * 각 변을 내부 법선 방향으로 평행이동 → 인접 변의 교차점을 새 꼭짓점으로.
 * 볼록 다각형에서 안정적. 오목/좁은 구역에서 self-intersection 가능하나
 * 작은 d 값에서는 실무상 문제 없음.
 */
function polygonInset(
  poly: [number, number][],
  d: number,
): [number, number][] {
  if (d <= 0 || poly.length < 3) return poly;

  // 회전 방향에 따라 내부 법선 부호 결정
  const area = signedArea(poly);
  if (Math.abs(area) < 1e-9) return poly;
  const sign = area > 0 ? 1 : -1;

  // 각 변 i: 시작점 + 단위방향벡터를 내부 법선 방향으로 d 만큼 평행이동
  const offsetLines: {
    p: [number, number];
    dir: [number, number];
  }[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    const ux = dx / len;
    const uy = dy / len;
    // 내부 법선 (CCW: 왼쪽 법선 = (-uy, ux))
    const nx = -uy * sign;
    const ny = ux * sign;
    offsetLines.push({
      p: [x1 + nx * d, y1 + ny * d],
      dir: [ux, uy],
    });
  }

  const m = offsetLines.length;
  if (m < 3) return poly;

  const result: [number, number][] = [];
  for (let i = 0; i < m; i++) {
    const prev = offsetLines[(i - 1 + m) % m];
    const curr = offsetLines[i];
    const pt = lineIntersect(prev.p, prev.dir, curr.p, curr.dir);
    if (pt) result.push(pt);
  }
  // 안전장치: 결과가 3점 미만이면 원본 반환
  return result.length >= 3 ? result : poly;
}

export interface LoadMapViewHandle {
  /** 현재 화면(zoom/pan 포함) SVG 를 PDF 로 저장 (A3 가로). */
  exportPdf: (storyName?: string) => Promise<void>;
  /**
   * FBLA 영역 다각형 + 솔리드 해치 + 텍스트 라벨을 DXF (mm 단위) 로 저장.
   * shrinkMm 은 프론트 슬라이더와 동일 의미로 백엔드에 전달돼 다각형이 inset 된다.
   */
  exportDxf: (storyName?: string, shrinkMm?: number) => Promise<void>;
}

function _triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke 는 클릭이 처리된 후 비동기로
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const LoadMapView = forwardRef<LoadMapViewHandle, Props>(function LoadMapView(
  {
    beams,
    areas,
    highlightFbld,
    onAreaHover,
    onAreaClick,
    minHeight = 360,
    maxHeight = 900,
    insetDistance = 0,
    grid,
  }: Props,
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    beams.forEach((b) => {
      xs.push(b.x1, b.x2);
      ys.push(b.y1, b.y2);
    });
    areas.forEach((a) =>
      a.polygon.forEach(([x, y]) => {
        xs.push(x);
        ys.push(y);
      }),
    );
    if (xs.length === 0 || ys.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    }
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [beams, areas]);

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

  const Ty = baseView.y * 2 + baseView.h;
  const transform = `translate(0, ${Ty}) scale(1, -1)`;

  const [view, setView] = useState<ViewBox | null>(null);
  const activeView = view ?? baseView;

  useEffect(() => {
    setView(null);
  }, [baseView.x, baseView.y, baseView.w, baseView.h]);

  const fontSize = Math.max(Math.min(activeView.w, activeView.h) * 0.02, 0.12);
  const strokeW = Math.min(activeView.w, activeView.h) * 0.003;

  const clampScaleView = useCallback(
    (nextView: ViewBox): ViewBox => {
      const scale = baseView.w / nextView.w;
      if (scale < MIN_SCALE) {
        const w = baseView.w / MIN_SCALE;
        const h = baseView.h / MIN_SCALE;
        return {
          x: nextView.x + (nextView.w - w) / 2,
          y: nextView.y + (nextView.h - h) / 2,
          w,
          h,
        };
      }
      if (scale > MAX_SCALE) {
        const w = baseView.w / MAX_SCALE;
        const h = baseView.h / MAX_SCALE;
        return {
          x: nextView.x + (nextView.w - w) / 2,
          y: nextView.y + (nextView.h - h) / 2,
          w,
          h,
        };
      }
      return nextView;
    },
    [baseView],
  );

  // 페이지 스크롤 차단 (passive 문제 회피)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const blockScroll = (e: WheelEvent) => e.preventDefault();
    svg.addEventListener("wheel", blockScroll, { passive: false });
    return () => svg.removeEventListener("wheel", blockScroll);
  }, []);

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

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const factor = e.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      const anchor = screenToWorld(e.clientX, e.clientY);
      const newW = activeView.w * factor;
      const newH = activeView.h * factor;
      const relX = (anchor.x - activeView.x) / activeView.w;
      const relY = (anchor.y - activeView.y) / activeView.h;
      setView(
        clampScaleView({
          x: anchor.x - relX * newW,
          y: anchor.y - relY * newH,
          w: newW,
          h: newH,
        }),
      );
    },
    [activeView, clampScaleView, screenToWorld],
  );

  const panStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startView: ViewBox;
    moved: boolean;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    panStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startView: activeView,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
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
  };

  const endPan = () => {
    panStateRef.current = null;
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

  const handleAreaClickInternal = (fbld: string) => {
    if (panStateRef.current?.moved) return;
    onAreaClick?.(fbld);
  };

  // ── PDF / DXF Export ──────────────────────────────────────────────────
  // 외부(page.tsx)에서 ref 로 호출. PDF 는 클라이언트사이드(jspdf+html-to-image),
  // DXF 는 백엔드 ezdxf 엔드포인트.
  useImperativeHandle(
    ref,
    () => ({
      exportPdf: async (storyName?: string) => {
        const svg = svgRef.current;
        if (!svg) throw new Error("SVG 가 아직 마운트되지 않았습니다");

        // 동적 import — 페이지 첫 로드 부담 줄이기
        const [{ jsPDF }, { toPng }] = await Promise.all([
          import("jspdf"),
          import("html-to-image"),
        ]);

        // 현재 SVG 의 화면 비율 (zoom/pan 그대로)
        const rect = svg.getBoundingClientRect();
        const aspect = rect.width / Math.max(rect.height, 1);

        // 흰 배경 캡처: SVG 의 dark 배경 + 다크 fill 도형 + 라이트/노랑 텍스트를 일시 변환.
        // - 모든 text 의 fill → #1f2937 (다크) 로 통일 (색상 다양성보다 가독성 우선)
        // - 다크 fill 의 circle (그리드 버블 등) → #ffffff (외곽선 stroke 는 그대로 유지)
        const darkFillRe = /^(#0f172a|#0F172A|#1e293b|#1E293B|#0a0f1c|#000000|#000|black)$/;
        const originalBg = svg.style.background;

        const textEls = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
        const originalTextFills = textEls.map((t) => t.getAttribute("fill"));

        // 다크 fill 도형 (circle/rect/path) — 같은 selector 로 한 번에
        const shapeEls = Array.from(
          svg.querySelectorAll<SVGElement>("circle, rect, path"),
        ).filter((el) => darkFillRe.test((el.getAttribute("fill") ?? "").trim()));
        const originalShapeFills = shapeEls.map((el) => el.getAttribute("fill"));

        let dataUrl: string;
        try {
          svg.style.background = "#ffffff";
          for (const t of textEls) t.setAttribute("fill", "#1f2937");
          for (const el of shapeEls) el.setAttribute("fill", "#ffffff");

          const pixelRatio =
            typeof window !== "undefined" ? Math.max(window.devicePixelRatio, 2) : 2;
          dataUrl = await toPng(svg as unknown as HTMLElement, {
            backgroundColor: "#ffffff",
            pixelRatio,
            cacheBust: true,
          });
        } finally {
          svg.style.background = originalBg;
          textEls.forEach((t, i) => {
            const f = originalTextFills[i];
            if (f !== null) t.setAttribute("fill", f);
            else t.removeAttribute("fill");
          });
          shapeEls.forEach((el, i) => {
            const f = originalShapeFills[i];
            if (f !== null) el.setAttribute("fill", f);
            else el.removeAttribute("fill");
          });
        }

        // A3 가로 (420×297mm), 여백 15mm + 보더라인
        const pageW = 420;
        const pageH = 297;
        const margin = 15;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        let drawW: number;
        let drawH: number;
        if (aspect >= availW / availH) {
          drawW = availW;
          drawH = drawW / aspect;
        } else {
          drawH = availH;
          drawW = drawH * aspect;
        }
        const offX = (pageW - drawW) / 2;
        const offY = (pageH - drawH) / 2;

        // 헤더 라벨 — Canvas 2D 로 직접 그려 PNG dataURL 생성.
        // jsPDF 의 helvetica 는 한글 미지원이라 텍스트로 직접 그리면 깨지므로 이미지로 임베드.
        // hidden DOM + html-to-image 방식보다 안정적 (layout 측정 의존 X, 비동기 X).
        const headerText = `Floor Load Map - ${storyName ?? "all"}, UNIT : kN/m²`;
        let headerPng: string | null = null;
        let headerAspect = 8;
        try {
          const fontPx = 40; // 캔버스 픽셀 (PDF 8mm × 5dpi 환산 + 여유)
          const padX = 24;
          const padY = 12;
          const fontFamily =
            '"Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", "Pretendard", sans-serif';
          const fontSpec = `700 ${fontPx}px ${fontFamily}`;

          // 1) 텍스트 폭 측정용 임시 캔버스
          const measure = document.createElement("canvas");
          const mctx = measure.getContext("2d");
          if (!mctx) throw new Error("2D context unavailable");
          mctx.font = fontSpec;
          const metrics = mctx.measureText(headerText);
          const textW = Math.max(1, Math.ceil(metrics.width));
          const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.85;
          const descent = metrics.actualBoundingBoxDescent || fontPx * 0.25;
          const textH = Math.max(1, Math.ceil(ascent + descent));

          const pr = Math.max(
            typeof window !== "undefined" ? window.devicePixelRatio : 1,
            2,
          );
          const cssW = textW + padX * 2;
          const cssH = textH + padY * 2;
          const canvas = document.createElement("canvas");
          canvas.width = cssW * pr;
          canvas.height = cssH * pr;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2D context unavailable");
          ctx.scale(pr, pr);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, cssW, cssH);
          ctx.fillStyle = "#1f2937";
          ctx.font = fontSpec;
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = "center";
          ctx.fillText(headerText, cssW / 2, padY + ascent);

          headerPng = canvas.toDataURL("image/png");
          headerAspect = cssW / cssH;
        } catch {
          // 헤더 그리기 실패 시 무시 (PDF 본문은 정상 출력)
        }

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
        // 페이지 흰 배경 (jsPDF 기본은 투명이지만 명시적으로 채워 안전하게)
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageW, pageH, "F");
        // 이미지 (zoom/pan 그대로 캡처된 SVG)
        doc.addImage(dataUrl, "PNG", offX, offY, drawW, drawH, undefined, "FAST");
        // 보더라인 — 여백 15mm 안쪽 사각형
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.4);
        doc.rect(margin, margin, availW, availH);

        // 헤더: 보더 위쪽 여백 영역, 페이지 상단 중앙
        if (headerPng) {
          const headerH = 8;  // mm
          const headerW = headerH * headerAspect;
          const headerX = (pageW - headerW) / 2;
          const headerY = (margin - headerH) / 2;  // 보더 위 여백 중앙
          doc.addImage(headerPng, "PNG", headerX, headerY, headerW, headerH);
        }

        const safeStory = (storyName ?? "all").replace(/\s+/g, "-");
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        doc.save(`load_map_${safeStory}_${stamp}.pdf`);
      },

      exportDxf: async (storyName?: string, shrinkMm: number = 0) => {
        const res = await fetch(`${BACKEND_URL}/api/loadcase/load-map/export-dxf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story_name: storyName ?? null,
            shrink_mm: Math.max(0, shrinkMm),
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`DXF 생성 실패 (${res.status}): ${errText.slice(0, 200)}`);
        }
        const blob = await res.blob();
        const safeStory = (storyName ?? "all").replace(/\s+/g, "-");
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        _triggerDownload(blob, `load_map_${safeStory}_${stamp}.dxf`);
      },
    }),
    [],
  );

  if (beams.length === 0 && areas.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500">
        표시할 데이터가 없습니다
      </div>
    );
  }

  const wrapperStyle: React.CSSProperties = {
    aspectRatio: `${baseView.w} / ${baseView.h}`,
    minHeight,
    maxHeight,
  };

  const scalePercent = Math.round((baseView.w / activeView.w) * 100);

  return (
    <div className="relative w-full" style={wrapperStyle}>
      <svg
        ref={svgRef}
        viewBox={`${activeView.x} ${activeView.y} ${activeView.w} ${activeView.h}`}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "#0f172a",
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
          {/* 축렬 오버레이 — 가장 하단 레이어 */}
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
              unitFactor={grid?.unitFactor ?? 1}
            />
          ))}
          {/* FBLA 다각형 (하중 영역) — 하단 레이어 */}
          {areas.map((a, i) => {
            const isHi = a.fbld_name === highlightFbld;
            const c = colorForLoad(a.fbld_name);
            const poly = polygonInset(a.polygon, insetDistance);
            const pts = poly.map(([x, y]) => `${x},${y}`).join(" ");
            return (
              <polygon
                key={`area-${i}-${a.fbld_name}`}
                points={pts}
                fill={isHi ? COLORS.selectedFill : c.fill}
                stroke={isHi ? COLORS.selectedStroke : c.stroke}
                strokeWidth={isHi ? strokeW * 2.4 : strokeW * 1.2}
                style={{ cursor: onAreaClick ? "pointer" : "default" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAreaClickInternal(a.fbld_name);
                }}
                onMouseEnter={() => onAreaHover?.(a.fbld_name)}
                onMouseLeave={() => onAreaHover?.(null)}
              />
            );
          })}

          {/* 보 라인 — 상단 레이어 (하중 영역 위)
              SKEW 는 공유 끝점 기반 polyline 체인으로 묶어 꺾임부 자연스럽게 */}
          {(() => {
            const axisBeams = beams.filter((b) => b.direction !== "SKEW");
            const skewBeams = beams.filter((b) => b.direction === "SKEW");
            // 끝점 스냅 tolerance = strokeWidth 수준 (월드 좌표)
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
                    strokeWidth={strokeW * 1.4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                ))}
                {axisBeams.map((b, i) => (
                  <line
                    key={`beam-${i}-${b.elem_id}`}
                    x1={b.x1}
                    y1={b.y1}
                    x2={b.x2}
                    y2={b.y2}
                    stroke={COLORS.beam}
                    strokeWidth={strokeW * 1.4}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                ))}
              </>
            );
          })()}
        </g>

        {/* 축렬 버블 — transform 밖에서 Y 수동 반전으로 똑바로 */}
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

        {/* 라벨 (Y 플립 수동) */}
        <g pointerEvents="none">
          {areas.map((a, i) => {
            const [wcx, wcy] = polygonCentroid(a.polygon);
            const cx = wcx;
            const cy = Ty - wcy;
            const mainSize = fontSize * 1.0;
            const subSize = fontSize * 0.8;
            return (
              <g key={`lbl-${i}`}>
                <text
                  x={cx}
                  y={cy - subSize * 1.0}
                  fontSize={mainSize}
                  fill={COLORS.text}
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontWeight={700}
                >
                  {a.fbld_name || "(이름없음)"}
                </text>
                <text
                  x={cx}
                  y={cy + subSize * 0.2}
                  fontSize={subSize}
                  fill="#fbbf24"
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontWeight={600}
                >
                  {a.factored.toFixed(2)}
                </text>
                <text
                  x={cx}
                  y={cy + subSize * 1.4}
                  fontSize={subSize * 0.9}
                  fill={COLORS.textSub}
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                >
                  {`D:${a.dl.toFixed(1)} / L:${a.ll.toFixed(1)}`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1 rounded-lg bg-gray-900/80 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => zoomAtCenter(1 / ZOOM_STEP)}
          title="확대"
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

      <div className="absolute left-2 top-2 rounded bg-gray-900/70 px-2 py-0.5 text-[10px] text-gray-400 backdrop-blur">
        {scalePercent}%
      </div>

      <div className="absolute bottom-2 left-2 rounded bg-gray-900/70 px-2 py-0.5 text-[10px] text-gray-500 backdrop-blur font-mono">
        X: {bounds.minX.toFixed(1)}~{bounds.maxX.toFixed(1)}m · Y: {bounds.minY.toFixed(1)}~
        {bounds.maxY.toFixed(1)}m
      </div>
    </div>
  );
});

export default LoadMapView;
