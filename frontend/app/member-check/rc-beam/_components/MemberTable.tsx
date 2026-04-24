"use client";

import { thCls, tdCls, tdMergedCls } from "../_lib/styles";
import type { MemberForceMaxRow } from "../_lib/types";

const POSITIONS = ["I", "C", "J"] as const;

/** rowSpan 병합 테이블 — 부재별 정리 */
export function MemberTable({ data }: { data: MemberForceMaxRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className={thCls}>부재</th>
            <th className={thCls}>위치</th>
            <th className={thCls}>LC</th>
            <th className={thCls}>My(-)</th>
            <th className={thCls}>LC</th>
            <th className={thCls}>My(+)</th>
            <th className={thCls}>LC</th>
            <th className={thCls}>Fz</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {data.map((r, gi) =>
            POSITIONS.map((pos, pi) => (
              <tr key={`${gi}-${pos}`} className={`${gi % 2 === 0 ? "bg-gray-800/80" : "bg-gray-900/60"} ${pi === 0 && gi > 0 ? "border-t-2 border-gray-500" : ""}`}>
                {pi === 0 && (
                  <td className={tdMergedCls} rowSpan={3}>{r.Memb}</td>
                )}
                <td className={tdCls}>{pos}</td>
                <td className={`${tdCls} text-gray-500`}>{(r as unknown as Record<string, unknown>)[`My_neg_${pos}_LC`] as string}</td>
                <td className={tdCls}>{String((r as unknown as Record<string, unknown>)[`My_neg_${pos}`])}</td>
                <td className={`${tdCls} text-gray-500`}>{(r as unknown as Record<string, unknown>)[`My_pos_${pos}_LC`] as string}</td>
                <td className={tdCls}>{String((r as unknown as Record<string, unknown>)[`My_pos_${pos}`])}</td>
                <td className={`${tdCls} text-gray-500`}>{(r as unknown as Record<string, unknown>)[`Fz_${pos}_LC`] as string}</td>
                <td className={tdCls}>{String((r as unknown as Record<string, unknown>)[`Fz_${pos}`])}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
