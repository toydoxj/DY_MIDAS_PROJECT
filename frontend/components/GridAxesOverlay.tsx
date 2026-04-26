"use client";

import { useMemo } from "react";

export interface GridAxisDef {
  label: string;
  offset: number;
}

export interface GridAxesOverlayProps {
  angleDeg: number;
  origin: [number, number];      // 주축 좌표계의 world 원점
  xAxes: GridAxisDef[];          // 주축1 방향 축렬 (주축2 법선 offset)
  yAxes: GridAxisDef[];          // 주축2 방향 축렬
  bbox: { minX: number; maxX: number; minY: number; maxY: number };
  strokeW: number;
  /** 버블 원 반경 (world 단위). null 이면 자동 (viewBox 비율). */
  bubbleRadius?: number;
  /** 버블 여백(평면 bbox 에서 얼마나 떨어뜨릴지). */
  bubbleOffset?: number;
  /** 선 색 (기본 파란, 추가 그룹은 그룹 고유 색). */
  color?: string;
  /** offset/origin 이 mm 단위로 들어올 때 모델 단위로 변환할 계수.
   *  예: MIDAS DIST=M 이면 0.001, DIST=MM 이면 1. 기본 1 (mm 그대로). */
  unitFactor?: number;
}

/**
 * 회전된 축렬 오버레이.
 *
 * 좌표계:
 *   ux1, uy1 = 주축1 방향 단위벡터
 *   ux2, uy2 = 주축2 방향 (90°)
 *   X 축렬 i 의 위치: origin + ux2 * x_axes[i].offset (법선 = 주축2)
 *   → 해당 축렬의 직선 방향 = 주축1 (ux1, uy1)
 *   Y 축렬 j: origin + ux1 * y_axes[j].offset, 방향 = 주축2
 */
export default function GridAxesOverlay({
  angleDeg,
  origin,
  xAxes,
  yAxes,
  bbox,
  strokeW,
  bubbleRadius,
  bubbleOffset,
  color = "#60a5fa",
  unitFactor = 1,
}: GridAxesOverlayProps) {
  const { ux1, uy1, ux2, uy2, lineSegs, bubbles } = useMemo(() => {
    const rad = (angleDeg * Math.PI) / 180;
    const ux1 = Math.cos(rad);
    const uy1 = Math.sin(rad);
    const ux2 = -uy1;
    const uy2 = ux1;

    // origin/offset 모두 mm → 모델 단위 변환
    const ox0 = origin[0] * unitFactor;
    const oy0 = origin[1] * unitFactor;

    // 평면 bounding box 의 주축 좌표계에서의 범위 계산
    const corners: [number, number][] = [
      [bbox.minX, bbox.minY],
      [bbox.maxX, bbox.minY],
      [bbox.maxX, bbox.maxY],
      [bbox.minX, bbox.maxY],
    ];
    const toLocal = (x: number, y: number): [number, number] => {
      const dx = x - ox0;
      const dy = y - oy0;
      return [dx * ux1 + dy * uy1, dx * ux2 + dy * uy2];
    };
    const local = corners.map(([x, y]) => toLocal(x, y));
    const u1Vals = local.map((p) => p[0]);
    const u2Vals = local.map((p) => p[1]);
    const u1Min = Math.min(...u1Vals);
    const u1Max = Math.max(...u1Vals);
    const u2Min = Math.min(...u2Vals);
    const u2Max = Math.max(...u2Vals);

    const span = Math.max(u1Max - u1Min, u2Max - u2Min, 1);
    const bOff = bubbleOffset ?? span * 0.08;
    const bR = bubbleRadius ?? span * 0.02;

    // world 좌표 변환: origin(world) + ux1*u1 + ux2*u2
    const toWorld = (u1: number, u2: number): [number, number] => [
      ox0 + ux1 * u1 + ux2 * u2,
      oy0 + uy1 * u1 + uy2 * u2,
    ];

    interface LineSeg {
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
    interface Bubble {
      id: string;
      cx: number;
      cy: number;
      r: number;
      label: string;
    }

    const lineSegs: LineSeg[] = [];
    const bubbles: Bubble[] = [];

    // X 축렬: u2 = offset 고정, u1 = u1Min~u1Max 선
    for (let i = 0; i < xAxes.length; i++) {
      const ax = xAxes[i];
      const u2v = ax.offset * unitFactor;
      const [p1x, p1y] = toWorld(u1Min - bOff, u2v);
      const [p2x, p2y] = toWorld(u1Max + bOff, u2v);
      lineSegs.push({ id: `x-line-${i}`, x1: p1x, y1: p1y, x2: p2x, y2: p2y });

      // 버블 2개 (양 끝)
      const [b1x, b1y] = toWorld(u1Min - bOff - bR * 0.2, u2v);
      const [b2x, b2y] = toWorld(u1Max + bOff + bR * 0.2, u2v);
      bubbles.push({ id: `x-bubble-${i}-L`, cx: b1x, cy: b1y, r: bR, label: ax.label });
      bubbles.push({ id: `x-bubble-${i}-R`, cx: b2x, cy: b2y, r: bR, label: ax.label });
    }
    // Y 축렬: u1 = offset 고정, u2 = u2Min~u2Max 선
    for (let j = 0; j < yAxes.length; j++) {
      const ax = yAxes[j];
      const u1v = ax.offset * unitFactor;
      const [p1x, p1y] = toWorld(u1v, u2Min - bOff);
      const [p2x, p2y] = toWorld(u1v, u2Max + bOff);
      lineSegs.push({ id: `y-line-${j}`, x1: p1x, y1: p1y, x2: p2x, y2: p2y });

      const [b1x, b1y] = toWorld(u1v, u2Min - bOff - bR * 0.2);
      const [b2x, b2y] = toWorld(u1v, u2Max + bOff + bR * 0.2);
      bubbles.push({ id: `y-bubble-${j}-B`, cx: b1x, cy: b1y, r: bR, label: ax.label });
      bubbles.push({ id: `y-bubble-${j}-T`, cx: b2x, cy: b2y, r: bR, label: ax.label });
    }

    return { ux1, uy1, ux2, uy2, lineSegs, bubbles };
  }, [angleDeg, origin, xAxes, yAxes, bbox, bubbleOffset, bubbleRadius, unitFactor]);

  if (lineSegs.length === 0 && bubbles.length === 0) return null;

  return (
    <g pointerEvents="none">
      {/* 축렬 점선 */}
      {lineSegs.map((ls) => (
        <line
          key={ls.id}
          x1={ls.x1}
          y1={ls.y1}
          x2={ls.x2}
          y2={ls.y2}
          stroke={color}
          strokeWidth={strokeW * 0.8}
          strokeDasharray={`${strokeW * 4} ${strokeW * 3}`}
          opacity={0.65}
        />
      ))}
    </g>
  );
}

/**
 * 버블(원 + 라벨) 레이어 — Y축 반전과 무관하게 **항상 똑바로** 텍스트 표시하기 위해
 * transform 그룹 **바깥** 에서 렌더한다. 좌표는 world 기준이지만 텍스트 y 를 수동 반전.
 */
export function GridAxesBubbles({
  angleDeg,
  origin,
  xAxes,
  yAxes,
  bbox,
  strokeW,
  Ty,
  bubbleRadius,
  bubbleOffset,
  color = "#60a5fa",
  unitFactor = 1,
}: GridAxesOverlayProps & { Ty: number }) {
  const bubbles = useMemo(() => {
    const rad = (angleDeg * Math.PI) / 180;
    const ux1 = Math.cos(rad);
    const uy1 = Math.sin(rad);
    const ux2 = -uy1;
    const uy2 = ux1;

    const ox0 = origin[0] * unitFactor;
    const oy0 = origin[1] * unitFactor;

    const corners: [number, number][] = [
      [bbox.minX, bbox.minY],
      [bbox.maxX, bbox.minY],
      [bbox.maxX, bbox.maxY],
      [bbox.minX, bbox.maxY],
    ];
    const toLocal = (x: number, y: number): [number, number] => {
      const dx = x - ox0;
      const dy = y - oy0;
      return [dx * ux1 + dy * uy1, dx * ux2 + dy * uy2];
    };
    const local = corners.map(([x, y]) => toLocal(x, y));
    const u1Vals = local.map((p) => p[0]);
    const u2Vals = local.map((p) => p[1]);
    const u1Min = Math.min(...u1Vals);
    const u1Max = Math.max(...u1Vals);
    const u2Min = Math.min(...u2Vals);
    const u2Max = Math.max(...u2Vals);
    const span = Math.max(u1Max - u1Min, u2Max - u2Min, 1);
    const bOff = bubbleOffset ?? span * 0.08;
    const bR = bubbleRadius ?? span * 0.02;

    const toWorld = (u1: number, u2: number): [number, number] => [
      ox0 + ux1 * u1 + ux2 * u2,
      oy0 + uy1 * u1 + uy2 * u2,
    ];

    interface B {
      id: string;
      cx: number;
      cy: number;
      r: number;
      label: string;
    }
    const out: B[] = [];
    for (let i = 0; i < xAxes.length; i++) {
      const ax = xAxes[i];
      const u2v = ax.offset * unitFactor;
      const [b1x, b1y] = toWorld(u1Min - bOff, u2v);
      const [b2x, b2y] = toWorld(u1Max + bOff, u2v);
      out.push({ id: `x-${i}-L`, cx: b1x, cy: b1y, r: bR, label: ax.label });
      out.push({ id: `x-${i}-R`, cx: b2x, cy: b2y, r: bR, label: ax.label });
    }
    for (let j = 0; j < yAxes.length; j++) {
      const ax = yAxes[j];
      const u1v = ax.offset * unitFactor;
      const [b1x, b1y] = toWorld(u1v, u2Min - bOff);
      const [b2x, b2y] = toWorld(u1v, u2Max + bOff);
      out.push({ id: `y-${j}-B`, cx: b1x, cy: b1y, r: bR, label: ax.label });
      out.push({ id: `y-${j}-T`, cx: b2x, cy: b2y, r: bR, label: ax.label });
    }
    return out;
  }, [angleDeg, origin, xAxes, yAxes, bbox, bubbleOffset, bubbleRadius, unitFactor]);

  if (bubbles.length === 0) return null;
  return (
    <g pointerEvents="none">
      {bubbles.map((b) => {
        // SVG Y 반전 수동: Ty - wcy
        const screenY = Ty - b.cy;
        return (
          <g key={b.id}>
            <circle
              cx={b.cx}
              cy={screenY}
              r={b.r}
              fill="#0f172a"
              stroke={color}
              strokeWidth={strokeW * 0.9}
            />
            <text
              x={b.cx}
              y={screenY + b.r * 0.35}
              fontSize={b.r * 0.9}
              fill="#ffffff"
              textAnchor="middle"
              fontFamily="ui-monospace, Menlo, monospace"
              fontWeight={700}
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
