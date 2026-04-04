"use client";

import SectionCard from "@/components/ui/SectionCard";
import type { PositionCheckResult } from "../_lib/types";

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-400 ml-1">&#x2713;</span>
    : <span className="text-red-400 ml-1">&#x2717;</span>;
}

function DcrCell({ dcr, ok }: { dcr: number; ok: boolean }) {
  const color = ok ? "text-green-400" : "text-red-400";
  return (
    <td className={`px-2 py-1 text-right font-mono font-semibold ${color}`}>
      {dcr < 900 ? dcr.toFixed(3) : "-"}
      <StatusIcon ok={ok} />
    </td>
  );
}

interface Props {
  results: PositionCheckResult[];
}

export default function DesignResult({ results }: Props) {
  if (results.length === 0) return null;

  const allOk = results.every((r) => r.all_ok);

  // 단면별 그룹핑
  const grouped = new Map<string, PositionCheckResult[]>();
  for (const r of results) {
    const arr = grouped.get(r.section_name) ?? [];
    arr.push(r);
    grouped.set(r.section_name, arr);
  }

  const th = "px-2 py-1.5 text-center text-gray-400 font-medium text-[10px] uppercase";
  const td = "px-2 py-1 text-right text-gray-300 font-mono";

  return (
    <SectionCard
      title="설계 검토 결과"
      action={
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${allOk ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
          {allOk ? "전체 적합" : "부적합 항목 있음"}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={th}>단면</th>
              <th className={th}>위치</th>
              <th className={th}>Mu (kN·m)</th>
              <th className={th}>φMn (kN·m)</th>
              <th className={th}>휨 DCR</th>
              <th className={th}>Vu (kN)</th>
              <th className={th}>φVn (kN)</th>
              <th className={th}>전단 DCR</th>
              <th className={th}>ρ</th>
              <th className={th}>ρ_min</th>
              <th className={th}>ρ_max</th>
              <th className={th}>철근비</th>
              <th className={th}>s (mm)</th>
              <th className={th}>s_max</th>
              <th className={th}>스터럽</th>
            </tr>
          </thead>
          <tbody>
            {[...grouped.entries()].map(([name, rows]) =>
              rows.map((r, ri) => (
                <tr key={`${name}-${r.position}`} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                  {ri === 0 && (
                    <td className="px-2 py-1 text-center text-white font-medium" rowSpan={rows.length}>{name}</td>
                  )}
                  <td className="px-2 py-1 text-center text-blue-400 font-medium">{r.position}</td>
                  <td className={td}>{r.Mu_d.toFixed(1)}</td>
                  <td className={td}>{r.phi_Mn.toFixed(1)}</td>
                  <DcrCell dcr={r.flexure_dcr} ok={r.flexure_ok} />
                  <td className={td}>{r.Vu_d.toFixed(1)}</td>
                  <td className={td}>{r.phi_Vn.toFixed(1)}</td>
                  <DcrCell dcr={r.shear_dcr} ok={r.shear_ok} />
                  <td className={td}>{r.rho.toFixed(5)}</td>
                  <td className={td}>{r.rho_min.toFixed(5)}</td>
                  <td className={td}>{r.rho_max.toFixed(5)}</td>
                  <td className="px-2 py-1 text-center">
                    <StatusIcon ok={r.rho_min_ok && r.rho_max_ok} />
                  </td>
                  <td className={td}>{r.stirrup_spacing}</td>
                  <td className={td}>{r.stirrup_max_spacing}</td>
                  <td className="px-2 py-1 text-center">
                    <StatusIcon ok={r.stirrup_ok} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
