"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { BACKEND_URL, EigenvalueRow, StoryShearRow, StoryWeightData } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import RefreshButton from "@/components/ui/RefreshButton";
import Select from "@/components/ui/Select";
import FormField from "@/components/ui/FormField";
import { ErrorText } from "@/components/ui/StatusMessage";

const SC_MAP: Record<number, string> = {
  0: "S1", 1: "S2", 2: "S3", 3: "S4", 4: "S5", 5: "S6",
};

// KDS 지반증폭계수 Fa 테이블: [S<=0.1, S<=0.2, S=0.3]
const FA_TABLE: Record<string, [number, number, number]> = {
  S1: [1.12, 1.12, 1.12],
  S2: [1.4, 1.4, 1.3],
  S3: [1.7, 1.5, 1.3],
  S4: [1.6, 1.4, 1.2],
  S5: [1.8, 1.3, 1.3],
};

// KDS 지반증폭계수 Fv 테이블: [S<=0.1, S<=0.2, S=0.3]
const FV_TABLE: Record<string, [number, number, number]> = {
  S1: [0.84, 0.84, 0.84],
  S2: [1.5, 1.4, 1.3],
  S3: [1.7, 1.6, 1.5],
  S4: [2.2, 2.0, 1.8],
  S5: [3.0, 2.7, 2.4],
};

const S_POINTS = [0.1, 0.2, 0.3];

/** S값에 따른 직선보간 */
function interpolate(table: [number, number, number], s: number): number {
  if (s <= S_POINTS[0]) return table[0];
  if (s >= S_POINTS[2]) return table[2];
  if (s <= S_POINTS[1]) {
    const t = (s - S_POINTS[0]) / (S_POINTS[1] - S_POINTS[0]);
    return table[0] + t * (table[1] - table[0]);
  }
  const t = (s - S_POINTS[1]) / (S_POINTS[2] - S_POINTS[1]);
  return table[1] + t * (table[2] - table[1]);
}

interface VItem { expected: number | string; ok: boolean }
interface ValidationResult {
  Fa: VItem; Fv: VItem; Sds: VItem; Sd1: VItem;
  SC: VItem; IE: VItem; R: VItem;
}

function validate(spfc: SPFCData, pc?: ProjectComment): ValidationResult | null {
  const siteClass = SC_MAP[spfc.SC];
  if (!siteClass || !FA_TABLE[siteClass]) return null;

  const s = spfc.ZONEFACTOR;
  const expectedFa = interpolate(FA_TABLE[siteClass], s);
  const expectedFv = interpolate(FV_TABLE[siteClass], s);
  const expectedSds = s * 2.5 * expectedFa * (2 / 3);
  const expectedSd1 = s * expectedFv * (2 / 3);

  const tol = 0.01; // 1% 허용 오차
  const numOk = (a: number, b: number) => Math.abs(a - b) / Math.max(b, 1e-9) < tol;

  // SiteClass 검증: 프로젝트 정보의 전단파속도/기반암깊이로 판정한 지반분류와 비교
  let scOk = true;
  let expectedSC = siteClass;
  if (pc) {
    const vel = parseFloat(pc.SHEAR_WAVE_VELOCITY ?? "0");
    const dep = parseFloat(pc.BEDROCK_DEPTH ?? "0");
    if (vel > 0 && dep > 0) {
      expectedSC = classifySoil(dep, vel);
      scOk = siteClass === expectedSC;
    }
  }

  // IE 검증: 프로젝트 정보의 중요도 계수와 비교
  const importance = pc?.IMPORTANCE ?? "(1)";
  const expectedIE = IE_MAP[importance] ?? 1.0;
  const ieOk = numOk(spfc.IE, expectedIE);

  // R 검증: 프로젝트 정보의 지진력저항시스템(X방향 기준)과 비교
  let expectedR = spfc.R;
  let rOk = true;
  if (pc?.SFRS_X) {
    const sfrs = SFRS_LIST.find((s) => s.id === pc.SFRS_X);
    if (sfrs) {
      expectedR = sfrs.R;
      rOk = numOk(spfc.R, expectedR);
    }
  }

  return {
    Fa: { expected: expectedFa, ok: numOk(spfc.Fa, expectedFa) },
    Fv: { expected: expectedFv, ok: numOk(spfc.Fv, expectedFv) },
    Sds: { expected: expectedSds, ok: numOk(spfc.Sds, expectedSds) },
    Sd1: { expected: expectedSd1, ok: numOk(spfc.Sd1, expectedSd1) },
    SC: { expected: expectedSC, ok: scOk },
    IE: { expected: expectedIE, ok: ieOk },
    R: { expected: expectedR, ok: rOk },
  };
}

interface FuncPoint { PERIOD: number; VALUE: number }

interface SPFCData {
  id: string; NAME: string; SPEC_CODE: string; ZONEFACTOR: number;
  SC: number; Sds: number; Sd1: number; Fa: number; Fv: number;
  IE: number; R: number; aFUNC: FuncPoint[];
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-400 text-base ml-1">&#x2713;</span>
    : <span className="text-red-400 text-base ml-1">&#x2717;</span>;
}

/* ── 정적해석 결과 타입 ── */

interface StoryDisplacement {
  story: string;
  level: number;
  dx: number;
  dy: number;
}

interface StoryDrift {
  story: string;
  level: number;
  height: number;
  drift_x: number;
  drift_y: number;
  ratio_x: number;
  ratio_y: number;
}

interface ReactionSum {
  lcName: string;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

const DRIFT_LIMIT = 1 / 200;

function formatTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ── 등가정적 지진하중 검토 로직 ── */

// 지반분류 자동 판정 (표 4.2-4)
function classifySoil(bedrockDepth: number, shearVelocity: number): string {
  if (bedrockDepth < 1) return "S1";
  if (bedrockDepth <= 20) return shearVelocity >= 260 ? "S2" : "S3";
  return shearVelocity >= 180 ? "S4" : "S5";
}

// 중요도 계수
const IE_MAP: Record<string, number> = { "특": 1.5, "(1)": 1.2, "(2)": 1.0, "(3)": 1.0 };

// 근사고유주기 구조형식
const STRUCT_TYPES = [
  { label: "철근콘크리트 전단벽구조, 기타골조", ct: 0.0488, x: 0.75 },
  { label: "철근콘크리트 모멘트골조", ct: 0.0466, x: 0.9 },
  { label: "철골모멘트 골조", ct: 0.0724, x: 0.8 },
  { label: "철골 편심가새골조 및 좌굴방지가새골조", ct: 0.0731, x: 0.75 },
] as const;

// Cu 보간 (표 7.2-1)
const CU_TABLE: [number, number][] = [[0.1, 1.7], [0.15, 1.6], [0.2, 1.5], [0.3, 1.4], [0.4, 1.4]];
function interpolateCu(sd1: number): number {
  if (sd1 <= CU_TABLE[0][0]) return CU_TABLE[0][1];
  if (sd1 >= CU_TABLE[CU_TABLE.length - 1][0]) return CU_TABLE[CU_TABLE.length - 1][1];
  for (let i = 0; i < CU_TABLE.length - 1; i++) {
    const [x0, y0] = CU_TABLE[i];
    const [x1, y1] = CU_TABLE[i + 1];
    if (sd1 >= x0 && sd1 <= x1) return y0 + ((sd1 - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1.7;
}

// 내진설계범주 판정 (표 5.2-1, 5.2-2)
function seismicCategory(sds: number, sd1: number, importance: string): string {
  const grade = importance === "특" ? 0 : importance === "(1)" ? 1 : 2;
  // Sds 기준
  let catSds: string;
  if (sds >= 0.50) catSds = "D";
  else if (sds >= 0.33) catSds = grade === 0 ? "D" : "C";
  else if (sds >= 0.17) catSds = grade === 0 ? "C" : "B";
  else catSds = "A";
  // Sd1 기준
  let catSd1: string;
  if (sd1 >= 0.20) catSd1 = "D";
  else if (sd1 >= 0.14) catSd1 = grade === 0 ? "D" : "C";
  else if (sd1 >= 0.07) catSd1 = grade === 0 ? "C" : "B";
  else catSd1 = "A";
  // 엄격한 쪽 적용
  const order = ["A", "B", "C", "D"];
  return order.indexOf(catSds) >= order.indexOf(catSd1) ? catSds : catSd1;
}

// 지진력저항시스템 목록 (표 6.2-1 주요 항목)
const SFRS_LIST = [
  // 1. 내력벽시스템
  { id: "1-a", name: "1-a. 철근콘크리트 특수전단벽", R: 5, omega: 2.5, Cd: 5, cat: "내력벽" },
  { id: "1-b", name: "1-b. 철근콘크리트 보통전단벽", R: 4, omega: 2.5, Cd: 4, cat: "내력벽" },
  { id: "1-c", name: "1-c. 철근보강 조적 전단벽", R: 2.5, omega: 2.5, Cd: 1.5, cat: "내력벽" },
  { id: "1-d", name: "1-d. 무보강 조적 전단벽", R: 1.5, omega: 2.5, Cd: 1.5, cat: "내력벽" },
  { id: "1-e", name: "1-e. 경골목구조 전단벽", R: 6, omega: 3, Cd: 4, cat: "내력벽" },
  { id: "1-f", name: "1-f. 경량철골조 전단벽", R: 6, omega: 3, Cd: 4, cat: "내력벽" },
  // 2. 건물골조시스템
  { id: "2-a", name: "2-a. 철골 편심가새골조 - 모멘트 저항 접합", R: 8, omega: 2, Cd: 4, cat: "건물골조" },
  { id: "2-b", name: "2-b. 철골 편심가새골조 - 비모멘트 저항접합", R: 7, omega: 2, Cd: 4, cat: "건물골조" },
  { id: "2-c", name: "2-c. 철골 특수중심가새골조", R: 6, omega: 2, Cd: 5, cat: "건물골조" },
  { id: "2-d", name: "2-d. 철골 보통중심가새골조", R: 3.25, omega: 2, Cd: 3.25, cat: "건물골조" },
  { id: "2-e", name: "2-e. 합성 편심가새골조", R: 8, omega: 2, Cd: 4, cat: "건물골조" },
  { id: "2-f", name: "2-f. 합성 특수중심가새골조", R: 5, omega: 2, Cd: 4.5, cat: "건물골조" },
  { id: "2-g", name: "2-g. 합성 보통중심가새골조", R: 3, omega: 2, Cd: 3, cat: "건물골조" },
  { id: "2-h", name: "2-h. 합성 강판전단벽", R: 6.5, omega: 2.5, Cd: 5.5, cat: "건물골조" },
  { id: "2-i", name: "2-i. 합성 특수전단벽", R: 6, omega: 2.5, Cd: 5, cat: "건물골조" },
  { id: "2-j", name: "2-j. 합성 보통전단벽", R: 5, omega: 2.5, Cd: 4.5, cat: "건물골조" },
  { id: "2-k", name: "2-k. 철골 특수강판전단벽", R: 7, omega: 2, Cd: 6, cat: "건물골조" },
  { id: "2-l", name: "2-l. 철골 좌굴방지가새골조 - 모멘트 저항 접합", R: 8, omega: 2.5, Cd: 5, cat: "건물골조" },
  { id: "2-m", name: "2-m. 철골 좌굴방지가새골조 - 비모멘트 저항 접합", R: 7, omega: 2, Cd: 5.5, cat: "건물골조" },
  { id: "2-n", name: "2-n. 철근콘크리트 특수전단벽", R: 6, omega: 2.5, Cd: 5, cat: "건물골조" },
  { id: "2-o", name: "2-o. 철근콘크리트 보통전단벽", R: 5, omega: 2.5, Cd: 4.5, cat: "건물골조" },
  { id: "2-p", name: "2-p. 철근보강 조적 전단벽", R: 3, omega: 2.5, Cd: 2, cat: "건물골조" },
  { id: "2-q", name: "2-q. 무보강 조적 전단벽", R: 1.5, omega: 2.5, Cd: 1.5, cat: "건물골조" },
  { id: "2-r", name: "2-r. 경골목구조 전단벽", R: 6.5, omega: 2.5, Cd: 4.5, cat: "건물골조" },
  { id: "2-s", name: "2-s. 경량철골조 전단벽", R: 6.5, omega: 2.5, Cd: 4.5, cat: "건물골조" },
  // 3. 모멘트-저항골조 시스템
  { id: "3-a", name: "3-a. 철골 특수모멘트골조", R: 8, omega: 3, Cd: 5.5, cat: "모멘트저항골조" },
  { id: "3-b", name: "3-b. 철골 중간모멘트골조", R: 4.5, omega: 3, Cd: 4, cat: "모멘트저항골조" },
  { id: "3-c", name: "3-c. 철골 보통모멘트골조", R: 3.5, omega: 3, Cd: 3, cat: "모멘트저항골조" },
  { id: "3-d", name: "3-d. 합성 특수모멘트골조", R: 8, omega: 3, Cd: 5.5, cat: "모멘트저항골조" },
  { id: "3-e", name: "3-e. 합성 중간모멘트골조", R: 5, omega: 3, Cd: 4.5, cat: "모멘트저항골조" },
  { id: "3-f", name: "3-f. 합성 보통모멘트골조", R: 3, omega: 3, Cd: 2.5, cat: "모멘트저항골조" },
  { id: "3-g", name: "3-g. 합성 반강접모멘트골조", R: 6, omega: 3, Cd: 5.5, cat: "모멘트저항골조" },
  { id: "3-h", name: "3-h. 철근콘크리트 특수모멘트골조", R: 8, omega: 3, Cd: 5.5, cat: "모멘트저항골조" },
  { id: "3-i", name: "3-i. 철근콘크리트 중간모멘트골조", R: 5, omega: 3, Cd: 4.5, cat: "모멘트저항골조" },
  { id: "3-j", name: "3-j. 철근콘크리트 보통모멘트골조", R: 3, omega: 3, Cd: 2.5, cat: "모멘트저항골조" },
  // 4. 이중골조 (특수모멘트골조)
  { id: "4-a", name: "4-a. 철골 편심가새골조", R: 8, omega: 2.5, Cd: 4, cat: "이중골조(특수)" },
  { id: "4-b", name: "4-b. 철골 특수중심가새골조", R: 7, omega: 2.5, Cd: 5.5, cat: "이중골조(특수)" },
  { id: "4-c", name: "4-c. 합성 편심가새골조", R: 8, omega: 2.5, Cd: 4, cat: "이중골조(특수)" },
  { id: "4-d", name: "4-d. 합성 특수중심가새골조", R: 6, omega: 2.5, Cd: 5, cat: "이중골조(특수)" },
  { id: "4-e", name: "4-e. 합성 강판전단벽", R: 7.5, omega: 2.5, Cd: 6, cat: "이중골조(특수)" },
  { id: "4-f", name: "4-f. 합성 특수전단벽", R: 7, omega: 2.5, Cd: 6, cat: "이중골조(특수)" },
  { id: "4-g", name: "4-g. 합성 보통전단벽", R: 6, omega: 2.5, Cd: 5, cat: "이중골조(특수)" },
  { id: "4-h", name: "4-h. 철골 좌굴방지가새골조", R: 8, omega: 2.5, Cd: 5, cat: "이중골조(특수)" },
  { id: "4-i", name: "4-i. 철골 특수강판전단벽", R: 8, omega: 2.5, Cd: 6.5, cat: "이중골조(특수)" },
  { id: "4-j", name: "4-j. 철근콘크리트 특수전단벽", R: 7, omega: 2.5, Cd: 5.5, cat: "이중골조(특수)" },
  { id: "4-k", name: "4-k. 철근콘크리트 보통전단벽", R: 6, omega: 2.5, Cd: 5, cat: "이중골조(특수)" },
  // 5. 이중골조 (중간모멘트골조)
  { id: "5-a", name: "5-a. 철골 특수중심가새골조", R: 6, omega: 2.5, Cd: 5, cat: "이중골조(중간)" },
  { id: "5-b", name: "5-b. 철근콘크리트 특수전단벽", R: 6.5, omega: 2.5, Cd: 5, cat: "이중골조(중간)" },
  { id: "5-c", name: "5-c. 철근콘크리트 보통전단벽", R: 5.5, omega: 2.5, Cd: 4.5, cat: "이중골조(중간)" },
  { id: "5-d", name: "5-d. 합성 특수중심가새골조", R: 5.5, omega: 2.5, Cd: 4.5, cat: "이중골조(중간)" },
  { id: "5-e", name: "5-e. 합성 보통중심가새골조", R: 3.5, omega: 2.5, Cd: 3, cat: "이중골조(중간)" },
  { id: "5-f", name: "5-f. 합성 보통전단벽", R: 5, omega: 3, Cd: 4.5, cat: "이중골조(중간)" },
  { id: "5-g", name: "5-g. 철근보강 조적 전단벽", R: 3, omega: 3, Cd: 2.5, cat: "이중골조(중간)" },
  // 6. 역추형 시스템
  { id: "6-a", name: "6-a. 캔틸레버 기둥 시스템", R: 2.5, omega: 2, Cd: 2.5, cat: "역추형" },
  { id: "6-b", name: "6-b. 철골 특수모멘트골조", R: 2.5, omega: 2, Cd: 2.5, cat: "역추형" },
  { id: "6-c", name: "6-c. 철골 보통모멘트골조", R: 1.25, omega: 2, Cd: 2.5, cat: "역추형" },
  { id: "6-d", name: "6-d. 철근콘크리트 특수모멘트골조", R: 2.5, omega: 2, Cd: 1.25, cat: "역추형" },
  // 7~10. 기타
  { id: "7", name: "7. RC 보통 전단벽-골조 상호작용 시스템", R: 4.5, omega: 2.5, Cd: 4, cat: "기타" },
  { id: "8", name: "8. 강구조기준 일반규정만을 만족하는 철골구조시스템", R: 3, omega: 3, Cd: 3, cat: "기타" },
  { id: "9", name: "9. RC구조기준 일반규정만을 만족하는 RC구조 시스템", R: 3, omega: 3, Cd: 3, cat: "기타" },
  { id: "10", name: "10. 지하외벽으로 둘러싸인 지하구조시스템", R: 3, omega: 3, Cd: 2.5, cat: "기타" },
] as const;

interface ProjectComment {
  IMPORTANCE?: string;
  SHEAR_WAVE_VELOCITY?: string;
  BEDROCK_DEPTH?: string;
  STRUCT_TYPE_X?: string;
  STRUCT_TYPE_Y?: string;
  SFRS_X?: string;
  SFRS_Y?: string;
}

function StatCard({ label, value, unit, status }: { label: string; value: string; unit?: string; status?: "ok" | "fail" | "info" }) {
  const color = status === "ok" ? "text-green-400" : status === "fail" ? "text-red-400" : "text-blue-400";
  return (
    <div className="rounded-md bg-gray-800/60 px-3 py-2">
      <span className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`font-medium text-sm ${color}`}>{value}</span>
        {unit && <span className="text-gray-500 text-xs">{unit}</span>}
      </div>
    </div>
  );
}

function ParamCard({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-md bg-gray-800/60 px-3 py-2">
      <span className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</span>
      <div className="flex items-center mt-0.5">
        <span className="text-white font-medium text-sm">{value}</span>
        {ok !== undefined && <StatusIcon ok={ok} />}
      </div>
    </div>
  );
}

export default function SeismicLoadPage() {
  const [data, setData] = useState<SPFCData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eigenRows, setEigenRows] = useState<EigenvalueRow[]>([]);
  const [eigenLoading, setEigenLoading] = useState(false);
  const [eigenTime, setEigenTime] = useState<Date | null>(null);
  const [eigenFetchFailed, setEigenFetchFailed] = useState(false);
  const [shearRows, setShearRows] = useState<StoryShearRow[]>([]);
  const [shearLoading, setShearLoading] = useState(false);
  const [shearTime, setShearTime] = useState<Date | null>(null);
  const [shearFetchFailed, setShearFetchFailed] = useState(false);
  const [eigenDisplayN, setEigenDisplayN] = useState(5);
  const [storyWeight, setStoryWeight] = useState<StoryWeightData | null>(null);

  // 등가정적 지진하중 검토 상태
  const [projectComment, setProjectComment] = useState<ProjectComment>({});
  const [analysisHeight, setAnalysisHeight] = useState(0);

  // 정적해석 결과 상태 (백엔드 미구현 - API 준비 시 활성화)
  const [displacements] = useState<StoryDisplacement[]>([]);
  const [drifts] = useState<StoryDrift[]>([]);
  const [reactions] = useState<ReactionSum[]>([]);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/spfc`);
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const fetchEigenvalue = async () => {
    setEigenLoading(true); setEigenFetchFailed(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/eigenvalue`);
      if (!res.ok) { setEigenFetchFailed(eigenRows.length > 0); return; }
      const rows = await res.json();
      setEigenRows(rows);
      if (rows.length > 0) setEigenTime(new Date());
      fetchStoryWeight();
    } catch { setEigenFetchFailed(eigenRows.length > 0); }
    finally { setEigenLoading(false); }
  };

  const fetchStoryShear = async () => {
    setShearLoading(true); setShearFetchFailed(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/story-shear`);
      if (!res.ok) { setShearFetchFailed(shearRows.length > 0); return; }
      const rows = await res.json();
      setShearRows(rows);
      if (rows.length > 0) setShearTime(new Date());
    } catch { setShearFetchFailed(shearRows.length > 0); }
    finally { setShearLoading(false); }
  };

  const fetchStoryWeight = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/story-weight`);
      if (res.ok) setStoryWeight(await res.json());
    } catch { /* ignore */ }
  };

  const fetchProjectInfo = async () => {
    try {
      // 프로젝트 정보 (중요도, 전단파속도, 기반암깊이)
      const res = await fetch(`${BACKEND_URL}/api/project`);
      if (res.ok) {
        const d = await res.json();
        try {
          setProjectComment(JSON.parse(d.COMMENT ?? "{}"));
        } catch { /* ignore */ }
      }
      // STOR에서 해석높이 (max STORY_LEVEL)
      const storRes = await fetch(`${BACKEND_URL}/api/midas/db/STOR`);
      if (storRes.ok) {
        const raw = await storRes.json();
        const stor = raw.STOR ?? {};
        let maxLevel = 0;
        for (const v of Object.values(stor)) {
          if (typeof v === "object" && v !== null && "STORY_LEVEL" in v) {
            const lvl = (v as { STORY_LEVEL: number }).STORY_LEVEL;
            if (lvl > maxLevel) maxLevel = lvl;
          }
        }
        setAnalysisHeight(maxLevel);
      }
    } catch { /* ignore */ }
  };

  // TODO: 백엔드 /api/results/* 구현 후 활성화
  // const fetchDisplacements = async () => { ... };
  // const fetchDrifts = async () => { ... };
  // const fetchReactions = async () => { ... };

  useEffect(() => { fetchData(); fetchEigenvalue(); fetchStoryShear(); fetchStoryWeight(); fetchProjectInfo(); }, []);

  const headerAction = <RefreshButton onClick={fetchData} loading={loading} />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Seismic Load" subtitle="지진하중" backHref="/loadcase" />

      {/* ════════ 등가정적 지진하중 검토 ════════ */}
      {data.length > 0 && (() => {
        const spfc = data[0];
        const importance = projectComment.IMPORTANCE ?? "(1)";
        const Ie = IE_MAP[importance] ?? 1.0;
        const shearVel = parseFloat(projectComment.SHEAR_WAVE_VELOCITY ?? "0");
        const bedrockDep = parseFloat(projectComment.BEDROCK_DEPTH ?? "0");
        const soilClass = (shearVel > 0 && bedrockDep > 0) ? classifySoil(bedrockDep, shearVel) : (SC_MAP[spfc.SC] ?? "-");

        const hn = analysisHeight;
        const Sds = spfc.Sds;
        const Sd1 = spfc.Sd1;
        const Cu = interpolateCu(Sd1);

        // X/Y 구조물 형식
        const stIdxX = parseInt(projectComment.STRUCT_TYPE_X ?? "0") || 0;
        const stIdxY = parseInt(projectComment.STRUCT_TYPE_Y ?? "0") || 0;
        const stX = STRUCT_TYPES[stIdxX] ?? STRUCT_TYPES[0];
        const stY = STRUCT_TYPES[stIdxY] ?? STRUCT_TYPES[0];
        const TaX = hn > 0 ? stX.ct * Math.pow(hn, stX.x) : 0;
        const TaY = hn > 0 ? stY.ct * Math.pow(hn, stY.x) : 0;

        // X/Y 지진력저항시스템
        const sfrsIdX = projectComment.SFRS_X ?? "1-a";
        const sfrsIdY = projectComment.SFRS_Y ?? "1-a";
        const sfrsX = SFRS_LIST.find((s) => s.id === sfrsIdX) ?? SFRS_LIST[0];
        const sfrsY = SFRS_LIST.find((s) => s.id === sfrsIdY) ?? SFRS_LIST[0];
        const Rx = sfrsX.R;
        const Ry = sfrsY.R;

        // 고유치 해석 주기 (X, Y dominant mode)
        let eigenPeriodX = 0;
        let eigenPeriodY = 0;
        if (eigenRows.length > 0) {
          let maxMassX = -1;
          let maxMassY = -1;
          for (const r of eigenRows) {
            if (r.mass_x > maxMassX) { maxMassX = r.mass_x; eigenPeriodX = r.period; }
            if (r.mass_y > maxMassY) { maxMassY = r.mass_y; eigenPeriodY = r.period; }
          }
        }

        // 적용주기
        const upperLimitX = Cu * TaX;
        const upperLimitY = Cu * TaY;
        const Tx = Math.max(TaX, Math.min(eigenPeriodX, upperLimitX));
        const Ty = Math.max(TaY, Math.min(eigenPeriodY, upperLimitY));

        // 내진설계범주
        const sdc = seismicCategory(Sds, Sd1, importance);

        // Cs (X, Y 별도 R 적용)
        const TL = 8;
        const calcCs = (T: number, R: number) => {
          let cs = Sds / (R / Ie);
          const csUpper = T <= TL ? Sd1 / ((R / Ie) * T) : (Sd1 * TL) / ((R / Ie) * T * T);
          cs = Math.min(cs, csUpper);
          const csLower = Math.max(0.044 * Sds * Ie, 0.01);
          return Math.max(cs, csLower);
        };
        const CsX = Tx > 0 ? calcCs(Tx, Rx) : 0;
        const CsY = Ty > 0 ? calcCs(Ty, Ry) : 0;

        const W = storyWeight?.total_weight ?? 0;
        const VxCalc = CsX * W;
        const VyCalc = CsY * W;

        // 응답스펙트럼 밑면전단력 (GL층 = level이 0에 가장 가까운 층)
        const glRow = shearRows.length > 0
          ? shearRows.reduce((best, r) => Math.abs(r.level) < Math.abs(best.level) ? r : best)
          : null;
        const VxRS = glRow ? Math.sqrt(glRow.rx_shear_x ** 2 + glRow.rx_shear_y ** 2) : 0;
        const VyRS = glRow ? Math.sqrt(glRow.ry_shear_x ** 2 + glRow.ry_shear_y ** 2) : 0;

        // Scale-up factor Cm = 0.85 * V_equiv / V_rs >= 1.0
        const CmX = (VxCalc > 0 && VxRS > 0) ? Math.max(0.85 * VxCalc / VxRS, 1.0) : 0;
        const CmY = (VyCalc > 0 && VyRS > 0) ? Math.max(0.85 * VyCalc / VyRS, 1.0) : 0;

        return (
          <SectionCard
            title="등가정적 지진하중 검토"
            action={
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${sdc === "D" ? "bg-red-900/40 text-red-400" : sdc === "C" ? "bg-yellow-900/40 text-yellow-400" : "bg-green-900/40 text-green-400"}`}>
                내진설계범주 {sdc}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">항목</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">X 방향</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Y 방향</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">비고</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">건물높이 (hn)</td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-gray-300 font-mono">{hn > 0 ? `${hn.toFixed(3)} m` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">해석높이</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">지반분류</td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-gray-300 font-mono">{soilClass}</td>
                    <td className="px-3 py-1.5 text-gray-500">Vs={shearVel > 0 ? `${shearVel}m/s` : "-"}, H={bedrockDep > 0 ? `${bedrockDep}m` : "-"}</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">중요도 / Ie</td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-gray-300 font-mono">{importance} / {Ie.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-gray-500">프로젝트 정보</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">Sds / Sd1</td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-gray-300 font-mono">{Sds.toFixed(4)} / {Sd1.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-gray-500">설계스펙트럼 가속도</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">구조물 형식</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 text-[10px]">{stX.label}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 text-[10px]">{stY.label}</td>
                    <td className="px-3 py-1.5 text-gray-500">프로젝트 정보에서 설정</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">근사고유주기 (Ta)</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{TaX > 0 ? `${TaX.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{TaY > 0 ? `${TaY.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">Ct×hn^x</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">주기상한 (Cu×Ta)</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{upperLimitX > 0 ? `${upperLimitX.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{upperLimitY > 0 ? `${upperLimitY.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">Cu={Cu.toFixed(2)}</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">고유치해석 주기</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{eigenPeriodX > 0 ? `${eigenPeriodX.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{eigenPeriodY > 0 ? `${eigenPeriodY.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">dominant mode</td>
                  </tr>
                  <tr className="border-b border-gray-700/30 bg-gray-700/20">
                    <td className="px-3 py-1.5 text-white font-semibold">적용주기 (T)</td>
                    <td className="px-3 py-1.5 text-right text-blue-400 font-mono font-semibold">{Tx > 0 ? `${Tx.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-blue-400 font-mono font-semibold">{Ty > 0 ? `${Ty.toFixed(4)} sec` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">max(Ta, min(T_eigen, Cu×Ta))</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">지진력저항시스템</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 text-[10px]">{sfrsX.name}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 text-[10px]">{sfrsY.name}</td>
                    <td className="px-3 py-1.5 text-gray-500">프로젝트 정보에서 설정</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">반응수정계수 (R)</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{Rx}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{Ry}</td>
                    <td className="px-3 py-1.5 text-gray-500"></td>
                  </tr>
                  <tr className="border-b border-gray-700/30 bg-gray-700/20">
                    <td className="px-3 py-1.5 text-white font-semibold">지진응답계수 (Cs)</td>
                    <td className="px-3 py-1.5 text-right text-blue-400 font-mono font-semibold">{CsX > 0 ? CsX.toFixed(5) : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-blue-400 font-mono font-semibold">{CsY > 0 ? CsY.toFixed(5) : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">Sds/(R/Ie), 상·하한 적용</td>
                  </tr>
                  <tr className="border-b border-gray-700/30">
                    <td className="px-3 py-1.5 text-white">구조물 중량 (W)</td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-gray-300 font-mono">{W > 0 ? `${W.toFixed(2)} kN` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{storyWeight ? `${storyWeight.gl_story} 기준` : ""}</td>
                  </tr>
                  <tr className="border-b border-gray-700/30 bg-gray-700/20">
                    <td className="px-3 py-1.5 text-white font-bold">등가정적 밑면전단력</td>
                    <td className="px-3 py-1.5 text-right text-green-400 font-mono font-bold">{VxCalc > 0 ? `${VxCalc.toFixed(2)} kN` : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-green-400 font-mono font-bold">{VyCalc > 0 ? `${VyCalc.toFixed(2)} kN` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">V = Cs × W</td>
                  </tr>
                  <tr className="border-b border-gray-700/30 bg-gray-700/20">
                    <td className="px-3 py-1.5 text-white font-bold">응답스펙트럼 밑면전단력</td>
                    <td className="px-3 py-1.5 text-right text-yellow-400 font-mono font-bold">{VxRS > 0 ? `${VxRS.toFixed(2)} kN` : "-"}</td>
                    <td className="px-3 py-1.5 text-right text-yellow-400 font-mono font-bold">{VyRS > 0 ? `${VyRS.toFixed(2)} kN` : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{glRow ? `SRSS (${glRow.story})` : "해석 결과 없음"}</td>
                  </tr>
                  <tr className="bg-gray-700/30">
                    <td className="px-3 py-1.5 text-white font-bold">Scale-up Factor (Cm)</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">
                      {CmX > 0 ? (
                        <span className={CmX > 1.0 ? "text-red-400" : "text-green-400"}>{CmX.toFixed(4)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">
                      {CmY > 0 ? (
                        <span className={CmY > 1.0 ? "text-red-400" : "text-green-400"}>{CmY.toFixed(4)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">0.85×V_등가/V_RS ≥ 1.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>
        );
      })()}

      {/* ════════ 정적해석 결과 섹션 (TODO: 백엔드 /api/results/* 구현 후 활성화) ════════ */}

      {/* ════════ 지진하중 섹션 ════════ */}
      {error && <ErrorText message={error} />}

      {data.length === 0 && !loading && !error && (
        <p className="text-sm text-gray-500">데이터 없음</p>
      )}

      {data.map((spfc) => {
        const v = validate(spfc, projectComment);
        const allOk = v && v.Fa.ok && v.Fv.ok && v.Sds.ok && v.Sd1.ok && v.SC.ok && v.IE.ok && v.R.ok;

        return (
          <div key={spfc.id} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title={`Design Spectrum — ${spfc.NAME}`}
              action={
                <div className="flex items-center gap-3">
                  {v && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${allOk ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                      {allOk ? "검증 통과" : "검증 실패"}
                    </span>
                  )}
                  {headerAction}
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <ParamCard label="Design Spectrum" value={spfc.SPEC_CODE} />
                <ParamCard label="유효지반가속도 (S)" value={spfc.ZONEFACTOR.toFixed(3)} />
                <ParamCard label="Site Class" value={SC_MAP[spfc.SC] ?? String(spfc.SC)} ok={v?.SC.ok} />
                <ParamCard label="중요도 계수 (Ie)" value={spfc.IE.toFixed(2)} ok={v?.IE.ok} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <ParamCard label="Fa (단주기)" value={spfc.Fa.toFixed(3)} ok={v?.Fa.ok} />
                <ParamCard label="Fv (1초주기)" value={spfc.Fv.toFixed(3)} ok={v?.Fv.ok} />
                <ParamCard label="Sds (단주기)" value={spfc.Sds.toFixed(4)} ok={v?.Sds.ok} />
                <ParamCard label="Sd1 (1초주기)" value={spfc.Sd1.toFixed(4)} ok={v?.Sd1.ok} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <ParamCard label="반응수정 계수 (R)" value={spfc.R.toFixed(2)} ok={v?.R.ok} />
                {storyWeight && (
                  <ParamCard label={`Building Weight (${storyWeight.gl_story}, GL=${storyWeight.gl_level})`} value={`${storyWeight.total_weight.toFixed(2)} kN`} />
                )}
              </div>

            </SectionCard>

            <SectionCard title="응답 스펙트럼 곡선">
              {spfc.aFUNC.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={spfc.aFUNC} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="PERIOD" type="number" domain={[0, "dataMax"]}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      label={{ value: "Period (sec)", position: "insideBottomRight", offset: -5, fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      label={{ value: "Acc (g)", angle: -90, position: "insideLeft", offset: -5, fill: "#9ca3af", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#f3f4f6" }}
                      formatter={(value) => [Number(value).toFixed(6), "Acc"]}
                      labelFormatter={(label) => `Period: ${Number(label).toFixed(4)} sec`}
                    />
                    <Line type="monotone" dataKey="VALUE" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-gray-500">스펙트럼 데이터 없음</p>
              )}
            </SectionCard>
          </div>
        );
      })}

      {/* Dominant Mode 요약 + 고유치 해석 결과 테이블 */}
      <SectionCard
        title="Eigenvalue Analysis"
        action={
          <div className="flex items-center gap-3">
            {eigenFetchFailed && (
              <span className="text-[10px] text-yellow-400">갱신 실패</span>
            )}
            {eigenTime && (
              <span className="text-[10px] text-gray-500">{formatTime(eigenTime)}</span>
            )}
            {eigenRows.length > 0 && (() => {
              const last = eigenRows[eigenRows.length - 1];
              const allOk = last.sum_x > 90 && last.sum_y > 90 && last.sum_rotn_z > 90;
              return (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${allOk ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                  {allOk ? "Sum > 90%" : "Sum < 90%"}
                </span>
              );
            })()}
            {eigenRows.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">표시</span>
                <select
                  value={eigenDisplayN}
                  onChange={(e) => setEigenDisplayN(Number(e.target.value))}
                  className="rounded bg-gray-700 border border-gray-600 px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: eigenRows.length }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>1~{n}차</option>
                  ))}
                </select>
              </div>
            )}
            <RefreshButton onClick={fetchEigenvalue} loading={eigenLoading} />
          </div>
        }
      >
        {eigenRows.length === 0 && !eigenLoading && (
          <p className="text-sm text-gray-500">해석 결과 대기 중</p>
        )}
        {eigenRows.length > 0 && (() => {
          // Mass 최대값 모드 탐색 (X, Y, ROTN-Z)
          let maxX = { mode: 0, val: -1 };
          let maxY = { mode: 0, val: -1 };
          let maxRZ = { mode: 0, val: -1 };
          for (const r of eigenRows) {
            if (r.mass_x > maxX.val) maxX = { mode: r.mode, val: r.mass_x };
            if (r.mass_y > maxY.val) maxY = { mode: r.mode, val: r.mass_y };
            if (r.mass_rotn_z > maxRZ.val) maxRZ = { mode: r.mode, val: r.mass_rotn_z };
          }

          // 마지막 모드의 Sum 검증 (90% 초과 여부)
          const lastRow = eigenRows[eigenRows.length - 1];
          const sumCheck = {
            x: { val: lastRow.sum_x, ok: lastRow.sum_x > 90 },
            y: { val: lastRow.sum_y, ok: lastRow.sum_y > 90 },
            rz: { val: lastRow.sum_rotn_z, ok: lastRow.sum_rotn_z > 90 },
          };

          // GL=0 (또는 가장 가까운 층) 에서 밑면 전단력
          const glRow = shearRows.length > 0
            ? shearRows.reduce((best, r) => Math.abs(r.level) < Math.abs(best.level) ? r : best)
            : null;

          const dominantModes = [
            { mode: maxX.mode, dir: "X", get: (r: EigenvalueRow) => r.mass_x },
            { mode: maxY.mode, dir: "Y", get: (r: EigenvalueRow) => r.mass_y },
            { mode: maxRZ.mode, dir: "ROTN-Z", get: (r: EigenvalueRow) => r.mass_rotn_z },
          ];

          return (
            <div className="space-y-4">
              {/* Dominant Mode 요약 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-3 py-2 text-center text-gray-400 font-medium">Mode</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium">Direction</th>
                      <th className="px-3 py-2 text-right text-gray-400 font-medium">Period (sec)</th>
                      <th className="px-3 py-2 text-right text-gray-400 font-medium">ShearForce X (kN)</th>
                      <th className="px-3 py-2 text-right text-gray-400 font-medium">ShearForce Y (kN)</th>
                      <th className="px-3 py-2 text-right text-gray-400 font-medium">ShearForce(SRSS) (kN)</th>
                      <th className="px-3 py-2 text-right text-gray-400 font-medium">Coefficient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dominantModes.map(({ mode, dir }) => {
                      const eigen = eigenRows.find((r) => r.mode === mode);
                      const sx = dir === "X" && glRow ? glRow.rx_shear_x
                        : dir === "Y" && glRow ? glRow.ry_shear_x : null;
                      const sy = dir === "X" && glRow ? glRow.rx_shear_y
                        : dir === "Y" && glRow ? glRow.ry_shear_y : null;
                      const srss = sx !== null && sy !== null ? Math.sqrt(sx * sx + sy * sy) : null;
                      const w = storyWeight?.total_weight;
                      const coeff = srss !== null && w && w > 0 ? srss / w : null;
                      return (
                        <tr key={dir} className="border-b border-gray-700/30">
                          <td className="px-3 py-1 text-center text-white font-medium">{mode}</td>
                          <td className="px-3 py-1 text-center text-blue-400 font-medium">{dir}</td>
                          <td className="px-3 py-1 text-right text-gray-300 font-mono">{eigen?.period.toFixed(4) ?? "-"}</td>
                          <td className="px-3 py-1 text-right text-gray-300 font-mono">{sx !== null ? sx.toFixed(2) : "-"}</td>
                          <td className="px-3 py-1 text-right text-gray-300 font-mono">{sy !== null ? sy.toFixed(2) : "-"}</td>
                          <td className="px-3 py-1 text-right text-gray-300 font-mono">{srss !== null ? srss.toFixed(2) : "-"}</td>
                          <td className="px-3 py-1 text-right text-gray-300 font-mono">{coeff !== null ? coeff.toFixed(3) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 고유치 해석 전체 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th rowSpan={2} className="px-2 py-1 text-center text-gray-400 font-medium border-r border-gray-700">Mode No</th>
                      <th rowSpan={2} className="px-2 py-1 text-center text-gray-400 font-medium border-r border-gray-700">Frequency<br/>(Cycle/Sec)</th>
                      <th rowSpan={2} className="px-2 py-1 text-center text-gray-400 font-medium border-r border-gray-700">Period<br/>(Sec)</th>
                      <th colSpan={6} className="px-2 py-1 text-center text-gray-400 font-medium border-r border-gray-700">Mass</th>
                      <th colSpan={6} className="px-2 py-1 text-center text-gray-400 font-medium">Sum</th>
                    </tr>
                    <tr className="border-b border-gray-700">
                      {["X", "Y", "ROTN-Z", "Z", "ROTN-X", "ROTN-Y"].map((h) => (
                        <th key={`mass-${h}`} className="px-2 py-1 text-center text-gray-500 font-medium border-r border-gray-700/50">{h}</th>
                      ))}
                      {["X", "Y", "ROTN-Z", "Z", "ROTN-X", "ROTN-Y"].map((h) => (
                        <th key={`sum-${h}`} className="px-2 py-1 text-center text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const lastIdx = eigenRows.length - 1;
                      const displayRows = eigenRows.filter((_, i) => i < eigenDisplayN || i === lastIdx);
                      const needsSeparator = eigenDisplayN < lastIdx;

                      return displayRows.map((r, di) => {
                        const i = eigenRows.indexOf(r);
                        const td = "px-2 py-1 text-right font-mono";
                        const tdN = `${td} text-gray-300`;
                        const tdR = `${td} text-red-400 font-semibold`;
                        const isLast = i === lastIdx;
                        const sumOkX = isLast && sumCheck.x.ok;
                        const sumOkY = isLast && sumCheck.y.ok;
                        const sumOkRZ = isLast && sumCheck.rz.ok;
                        const sumFailX = isLast && !sumCheck.x.ok;
                        const sumFailY = isLast && !sumCheck.y.ok;
                        const sumFailRZ = isLast && !sumCheck.rz.ok;
                        const tdOk = `${td} text-green-400 font-semibold`;
                        const tdFail = `${td} text-red-400 font-semibold`;
                        const showSep = needsSeparator && di === eigenDisplayN - 1;

                        return (
                          <React.Fragment key={r.mode}>
                            <tr className="border-b border-gray-700/30 hover:bg-gray-700/20">
                              <td className="px-2 py-1 text-center text-white font-medium">{r.mode}</td>
                              <td className={tdN}>{r.frequency.toFixed(4)}</td>
                              <td className={tdN}>{r.period.toFixed(4)}</td>
                              <td className={r.mode === maxX.mode ? tdR : tdN}>{r.mass_x.toFixed(2)}</td>
                              <td className={r.mode === maxY.mode ? tdR : tdN}>{r.mass_y.toFixed(2)}</td>
                              <td className={r.mode === maxRZ.mode ? tdR : tdN}>{r.mass_rotn_z.toFixed(2)}</td>
                              <td className={tdN}>{r.mass_z.toFixed(2)}</td>
                              <td className={tdN}>{r.mass_rotn_x.toFixed(2)}</td>
                              <td className={tdN}>{r.mass_rotn_y.toFixed(2)}</td>
                              <td className={sumOkX ? tdOk : sumFailX ? tdFail : tdN}>{r.sum_x.toFixed(2)}</td>
                              <td className={sumOkY ? tdOk : sumFailY ? tdFail : tdN}>{r.sum_y.toFixed(2)}</td>
                              <td className={sumOkRZ ? tdOk : sumFailRZ ? tdFail : tdN}>{r.sum_rotn_z.toFixed(2)}</td>
                              <td className={tdN}>{r.sum_z.toFixed(2)}</td>
                              <td className={tdN}>{r.sum_rotn_x.toFixed(2)}</td>
                              <td className={tdN}>{r.sum_rotn_y.toFixed(2)}</td>
                            </tr>
                            {showSep && (
                              <tr className="border-b border-gray-700/30">
                                <td colSpan={15} className="px-2 py-1 text-center text-gray-600 text-xs">...</td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </SectionCard>

      {/* 밑면 전단력 테이블 */}
      <SectionCard
        title="Story Shear (Response Spectrum)"
        action={
          <div className="flex items-center gap-3">
            {shearFetchFailed && (
              <span className="text-[10px] text-yellow-400">갱신 실패</span>
            )}
            {shearTime && (
              <span className="text-[10px] text-gray-500">{formatTime(shearTime)}</span>
            )}
            <RefreshButton onClick={fetchStoryShear} loading={shearLoading} />
          </div>
        }
      >
        {shearRows.length === 0 && !shearLoading && (
          <p className="text-sm text-gray-500">해석 결과 대기 중</p>
        )}
        {shearRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th rowSpan={2} className="px-3 py-1 text-center text-gray-400 font-medium border-r border-gray-700">Story</th>
                  <th colSpan={3} className="px-3 py-1 text-center text-gray-400 font-medium border-r border-gray-700">RX (RS)</th>
                  <th colSpan={3} className="px-3 py-1 text-center text-gray-400 font-medium">RY (RS)</th>
                </tr>
                <tr className="border-b border-gray-700">
                  <th className="px-3 py-1 text-right text-gray-500 font-medium">ShearForce X</th>
                  <th className="px-3 py-1 text-right text-gray-500 font-medium">ShearForce Y</th>
                  <th className="px-3 py-1 text-right text-gray-500 font-medium border-r border-gray-700">Story Force</th>
                  <th className="px-3 py-1 text-right text-gray-500 font-medium">ShearForce X</th>
                  <th className="px-3 py-1 text-right text-gray-500 font-medium">ShearForce Y</th>
                  <th className="px-3 py-1 text-right text-gray-500 font-medium">Story Force</th>
                </tr>
              </thead>
              <tbody>
                {shearRows.map((r) => {
                  const td = "px-3 py-1 text-right text-gray-300 font-mono";
                  return (
                    <tr key={r.story} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                      <td className="px-3 py-1 text-white font-medium border-r border-gray-700">{r.story}</td>
                      <td className={td}>{r.rx_shear_x.toFixed(2)}</td>
                      <td className={td}>{r.rx_shear_y.toFixed(2)}</td>
                      <td className={`${td} border-r border-gray-700`}>{r.rx_story_force.toFixed(2)}</td>
                      <td className={td}>{r.ry_shear_x.toFixed(2)}</td>
                      <td className={td}>{r.ry_shear_y.toFixed(2)}</td>
                      <td className={td}>{r.ry_story_force.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
