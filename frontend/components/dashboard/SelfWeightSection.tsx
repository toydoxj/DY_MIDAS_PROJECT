"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { BACKEND_URL, SelfWeightRow, StructureMass, LoadToMassData } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import RefreshButton from "@/components/ui/RefreshButton";
import { ErrorText } from "@/components/ui/StatusMessage";

export default function SelfWeightSection() {
  const [rows, setRows] = useState<SelfWeightRow[]>([]);
  const [massDat, setMassDat] = useState<StructureMass | null>(null);
  const [ltomDat, setLtomDat] = useState<LoadToMassData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const [swRes, massRes, ltomRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/selfweight`).catch(() => null),
        fetch(`${BACKEND_URL}/api/structure-mass`).catch(() => null),
        fetch(`${BACKEND_URL}/api/load-to-mass`).catch(() => null),
      ]);
      if (swRes?.ok) setRows(await swRes.json());
      else if (swRes) setError(`자중 조회 오류: ${swRes.status}`);
      if (massRes?.ok) setMassDat(await massRes.json());
      if (ltomRes?.ok) setLtomDat(await ltomRes.json());
      if (!swRes && !massRes && !ltomRes) setError("백엔드 연결 실패");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Settings2 size={16} /> SETTING
        </h2>
        <RefreshButton onClick={fetchData} loading={loading} />
      </div>

      {error && <ErrorText message={error} />}

      {/* Structure Mass */}
      {massDat && (
        <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-blue-400">Structure Mass</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-gray-800/60 px-3 py-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Mass Type</span>
              <div className="text-white font-medium mt-0.5">{massDat.MASS_LABEL}</div>
            </div>
            <div className="rounded-md bg-gray-800/60 px-3 py-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Convert Mass</span>
              <div className="text-white font-medium mt-0.5">{massDat.SMASS_LABEL}</div>
            </div>
          </div>
        </div>
      )}

      {/* 자중입력 확인 */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">자중입력 확인</h3>
        {rows.length === 0 && !loading && !error && <p className="text-xs text-gray-500">데이터 없음</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead><tr className="border-b border-gray-600/50">
                <th className="pb-2 pr-4 font-medium text-gray-400">Load Case</th>
                <th className="pb-2 pr-4 font-medium text-gray-400 text-right">Factor</th>
                <th className="pb-2 font-medium text-gray-400 text-center w-10"></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-700/30 hover:bg-gray-600/20">
                    <td className="py-1.5 pr-4 text-white">{r.LCNAME}</td>
                    <td className="py-1.5 pr-4 text-gray-300 text-right">{r.factor !== null ? r.factor : "-"}</td>
                    <td className="py-1.5 text-center text-lg">{r.valid ? <span className="text-green-400">●</span> : <span className="text-red-400">●</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loads to Masses */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">Loads to Masses</h3>
        {!ltomDat && !loading && <p className="text-xs text-gray-500">데이터 없음</p>}
        {ltomDat && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mass Direction</span>
                <div className="flex gap-1.5">
                  {(["X", "Y", "Z"] as const).map((d) => (
                    <span key={d} className={ltomDat[`DIR_${d}`] ? "text-green-400" : "text-gray-600"}>
                      {ltomDat[`DIR_${d}`] ? "\u2713" : "\u2717"}{d}
                    </span>
                  ))}
                </div>
              </div>
              <div />
              {([["bNODAL", "Nodal Load"], ["bBEAM", "Beam Load"], ["bFLOOR", "Floor Load"], ["bPRES", "Pressure"]] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className={ltomDat[key] ? "text-green-400" : "text-gray-600"}>{ltomDat[key] ? "\u2713" : "\u2717"}</span>
                </div>
              ))}
            </div>
            {ltomDat.vLC.length > 0 && (
              <div className="mt-2">
                <table className="w-full text-xs text-left">
                  <thead><tr className="border-b border-gray-600/50">
                    <th className="pb-1 pr-4 font-medium text-gray-400">Load Case</th>
                    <th className="pb-1 font-medium text-gray-400 text-right">Scale Factor</th>
                  </tr></thead>
                  <tbody>
                    {ltomDat.vLC.map((lc, i) => (
                      <tr key={i} className="border-b border-gray-700/30">
                        <td className="py-1 pr-4 text-white">{lc.LCNAME}</td>
                        <td className="py-1 text-gray-300 text-right">{lc.FACTOR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
