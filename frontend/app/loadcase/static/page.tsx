"use client";

import { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { BACKEND_URL } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import RefreshButton from "@/components/ui/RefreshButton";
import { SavedBadge, ErrorText } from "@/components/ui/StatusMessage";

const TYPE_MAP: Record<string, string> = {
  D: "Dead Load",
  L: "Live Load",
  W: "Wind Load",
  WA: "Wind Load (Across)",
  EH: "Earth Pressure",
};
const TYPE_OPTIONS = Object.entries(TYPE_MAP);

interface LoadCaseRow {
  id: string;
  NAME: string;
  TYPE: string;
  DESC: string;
}

interface SPLCRow {
  id: string;
  NAME: string;
  DIR: string;
  ANGLE: number;
  aFUNCNAME: string[];
  COMTYPE: string;
  bADDSIGN: boolean;
  bACCECC: boolean;
}

export default function LoadCasePage() {
  const [rows, setRows] = useState<LoadCaseRow[]>([]);
  const [splcRows, setSplcRows] = useState<SPLCRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null); setSaved(false);
    try {
      const [lcRes, splcRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/loadcase`).catch(() => null),
        fetch(`${BACKEND_URL}/api/splc`).catch(() => null),
      ]);
      if (lcRes?.ok) setRows(await lcRes.json());
      else if (lcRes) setError(`서버 오류: ${lcRes.status}`);
      if (splcRes?.ok) setSplcRows(await splcRes.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const updateRow = (idx: number, field: keyof LoadCaseRow, value: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setSaved(false);
  };

  const addRow = () => {
    const maxId = rows.reduce((max, r) => Math.max(max, parseInt(r.id)), 0);
    setRows((prev) => [...prev, { id: String(maxId + 1), NAME: "", TYPE: "D", DESC: "" }]);
    setSaved(false);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/loadcase`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      setSaved(true);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const headerAction = (
    <>
      {saved && <SavedBadge label="업데이트됨" />}
      <RefreshButton onClick={fetchData} loading={loading} />
      <Button
        size="xs"
        onClick={handleSave}
        disabled={rows.length === 0}
        loading={saving}
      >
        <Save size={13} />
        {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
      </Button>
    </>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Load Case" subtitle="하중 케이스 관리" backHref="/loadcase" />

      <SectionCard title="Static Load Case" action={headerAction}>
        {error && <ErrorText message={error} />}

        {rows.length === 0 && !loading && !error && (
          <p className="text-xs text-gray-500">데이터 없음</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-2 pr-4 font-medium text-gray-400 w-12 text-center">No</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400">Name</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400 w-52">Type</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400">Description</th>
                  <th className="pb-2 font-medium text-gray-400 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-b border-gray-700/50">
                    <td className="py-1.5 pr-4 text-gray-500 text-center">{r.id}</td>
                    <td className="py-1.5 pr-4">
                      <input value={r.NAME} onChange={(e) => updateRow(idx, "NAME", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="py-1.5 pr-4">
                      <select value={r.TYPE} onChange={(e) => updateRow(idx, "TYPE", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                        {TYPE_OPTIONS.map(([code, label]) => (
                          <option key={code} value={code}>{label}</option>
                        ))}
                        {!TYPE_MAP[r.TYPE] && <option value={r.TYPE}>{r.TYPE}</option>}
                      </select>
                    </td>
                    <td className="py-1.5 pr-4">
                      <input value={r.DESC} onChange={(e) => updateRow(idx, "DESC", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => removeRow(idx)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mt-2">
          <Plus size={13} /> Load Case 추가
        </button>
      </SectionCard>

      <SectionCard title="Response Spectrum Load Case">
        {splcRows.length === 0 && !loading && (
          <p className="text-xs text-gray-500">데이터 없음</p>
        )}

        {splcRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-2 pr-4 font-medium text-gray-400">하중조합</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400 text-center">방향</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400 text-right">각도</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400">응답스펙트럼</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400 text-center">조합Type</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400 text-center">부호조합</th>
                  <th className="pb-2 font-medium text-gray-400 text-center">우발편심</th>
                </tr>
              </thead>
              <tbody>
                {splcRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                    <td className="py-1.5 pr-4 text-white">{r.NAME}</td>
                    <td className="py-1.5 pr-4 text-gray-300 text-center">{r.DIR}</td>
                    <td className="py-1.5 pr-4 text-gray-300 text-right">{r.ANGLE}°</td>
                    <td className="py-1.5 pr-4 text-gray-300">{r.aFUNCNAME.join(", ")}</td>
                    <td className="py-1.5 pr-4 text-gray-300 text-center">{r.COMTYPE}</td>
                    <td className="py-1.5 pr-4 text-center">
                      <span className={r.bADDSIGN ? "text-green-400" : "text-gray-600"}>{r.bADDSIGN ? "✓" : "✗"}</span>
                    </td>
                    <td className="py-1.5 text-center">
                      <span className={r.bACCECC ? "text-green-400" : "text-gray-600"}>{r.bACCECC ? "✓" : "✗"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
