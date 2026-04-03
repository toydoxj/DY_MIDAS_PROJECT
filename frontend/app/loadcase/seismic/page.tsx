"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BACKEND_URL, EigenvalueRow, StoryShearRow, StoryWeightData } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import RefreshButton from "@/components/ui/RefreshButton";
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

interface ValidationResult {
  Fa: { expected: number; ok: boolean };
  Fv: { expected: number; ok: boolean };
  Sds: { expected: number; ok: boolean };
  Sd1: { expected: number; ok: boolean };
}

function validate(spfc: SPFCData): ValidationResult | null {
  const siteClass = SC_MAP[spfc.SC];
  if (!siteClass || !FA_TABLE[siteClass]) return null;

  const s = spfc.ZONEFACTOR;
  const expectedFa = interpolate(FA_TABLE[siteClass], s);
  const expectedFv = interpolate(FV_TABLE[siteClass], s);
  const expectedSds = s * 2.5 * expectedFa * (2 / 3);
  const expectedSd1 = s * expectedFv * (2 / 3);

  const tol = 0.01; // 1% 허용 오차
  return {
    Fa: { expected: expectedFa, ok: Math.abs(spfc.Fa - expectedFa) / Math.max(expectedFa, 1e-9) < tol },
    Fv: { expected: expectedFv, ok: Math.abs(spfc.Fv - expectedFv) / Math.max(expectedFv, 1e-9) < tol },
    Sds: { expected: expectedSds, ok: Math.abs(spfc.Sds - expectedSds) / Math.max(expectedSds, 1e-9) < tol },
    Sd1: { expected: expectedSd1, ok: Math.abs(spfc.Sd1 - expectedSd1) / Math.max(expectedSd1, 1e-9) < tol },
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
  const [eigenError, setEigenError] = useState<string | null>(null);
  const [shearRows, setShearRows] = useState<StoryShearRow[]>([]);
  const [shearLoading, setShearLoading] = useState(false);
  const [shearError, setShearError] = useState<string | null>(null);
  const [eigenDisplayN, setEigenDisplayN] = useState(5);
  const [storyWeight, setStoryWeight] = useState<StoryWeightData | null>(null);

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
    setEigenLoading(true); setEigenError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/eigenvalue`);
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setEigenRows(await res.json());
    } catch (e) { setEigenError(String(e)); }
    finally { setEigenLoading(false); }
  };

  const fetchStoryShear = async () => {
    setShearLoading(true); setShearError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/story-shear`);
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setShearRows(await res.json());
    } catch (e) { setShearError(String(e)); }
    finally { setShearLoading(false); }
  };

  const fetchStoryWeight = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/story-weight`);
      if (res.ok) setStoryWeight(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchData(); fetchEigenvalue(); fetchStoryShear(); fetchStoryWeight(); }, []);

  const headerAction = <RefreshButton onClick={fetchData} loading={loading} />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Seismic Load" subtitle="지진하중" backHref="/loadcase" />

      {error && <ErrorText message={error} />}

      {data.length === 0 && !loading && !error && (
        <p className="text-sm text-gray-500">데이터 없음</p>
      )}

      {data.map((spfc) => {
        const v = validate(spfc);
        const allOk = v && v.Fa.ok && v.Fv.ok && v.Sds.ok && v.Sd1.ok;

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
                <ParamCard label="Site Class" value={SC_MAP[spfc.SC] ?? String(spfc.SC)} />
                <ParamCard label="중요도 계수 (Ie)" value={spfc.IE.toFixed(2)} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <ParamCard label="Fa (단주기)" value={spfc.Fa.toFixed(3)} ok={v?.Fa.ok} />
                <ParamCard label="Fv (1초주기)" value={spfc.Fv.toFixed(3)} ok={v?.Fv.ok} />
                <ParamCard label="Sds (단주기)" value={spfc.Sds.toFixed(4)} ok={v?.Sds.ok} />
                <ParamCard label="Sd1 (1초주기)" value={spfc.Sd1.toFixed(4)} ok={v?.Sd1.ok} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <ParamCard label="반응수정 계수 (R)" value={spfc.R.toFixed(2)} />
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
        {eigenError && <ErrorText message={eigenError} />}
        {eigenRows.length === 0 && !eigenLoading && !eigenError && (
          <p className="text-sm text-gray-500">데이터 없음</p>
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
        action={<RefreshButton onClick={fetchStoryShear} loading={shearLoading} />}
      >
        {shearError && <ErrorText message={shearError} />}
        {shearRows.length === 0 && !shearLoading && !shearError && (
          <p className="text-sm text-gray-500">데이터 없음</p>
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
