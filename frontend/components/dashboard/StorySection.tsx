"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL, StoryRow } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import RefreshButton from "@/components/ui/RefreshButton";
import { ErrorText } from "@/components/ui/StatusMessage";

export default function StorySection({ onRowsChange }: { onRowsChange: (rows: StoryRow[]) => void }) {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/midas/db/STOR`);
      const d = await r.json();
      const stor: Record<string, Record<string, unknown>> = d?.STOR ?? {};
      const sorted = Object.entries(stor)
        .map(([id, v]) => ({ id, STORY_NAME: String(v.STORY_NAME ?? ""), STORY_LEVEL: Number(v.STORY_LEVEL ?? 0), bFLOOR_DIAPHRAGM: Boolean(v.bFLOOR_DIAPHRAGM ?? false) }))
        .sort((a, b) => a.STORY_LEVEL - b.STORY_LEVEL);
      const parsed: StoryRow[] = sorted.map((row, i) => ({ ...row, HEIGHT: i === 0 ? row.STORY_LEVEL : row.STORY_LEVEL - sorted[i - 1].STORY_LEVEL }));
      const reversed = parsed.reverse();
      setRows(reversed); onRowsChange(reversed);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, []);

  const headerAction = <RefreshButton onClick={fetch_} loading={loading} />;

  return (
    <SectionCard title="층 설정" action={headerAction}>
      {error && <ErrorText message={error} />}
      {rows.length === 0 && !loading && !error && <p className="text-xs text-gray-500">데이터 없음</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 pr-4 font-medium text-gray-400">StoryName</th>
                <th className="pb-2 pr-4 font-medium text-gray-400 text-right">StoryLevel</th>
                <th className="pb-2 pr-4 font-medium text-gray-400 text-right">StoryHeight</th>
                <th className="pb-2 font-medium text-gray-400 text-center">Diaphragm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50">
                  <td className="py-1.5 pr-4 text-white">{r.STORY_NAME}</td>
                  <td className="py-1.5 pr-4 text-gray-700 text-right">{r.STORY_LEVEL.toFixed(3)}</td>
                  <td className="py-1.5 pr-4 text-gray-700 text-right">{r.HEIGHT.toFixed(3)}</td>
                  <td className="py-1.5 text-center">
                    {r.bFLOOR_DIAPHRAGM ? <span className="text-emerald-600">●</span> : <span className="text-gray-400">○</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
