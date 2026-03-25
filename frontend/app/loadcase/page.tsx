"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, Save, Plus, Trash2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// TYPE 약자 → 풀네임 매핑
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

export default function LoadCasePage() {
  const [rows, setRows] = useState<LoadCaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/loadcase`);
      if (!r.ok) throw new Error(`서버 오류: ${r.status}`);
      const data: LoadCaseRow[] = await r.json();
      setRows(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
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
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/loadcase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">하중정보</h1>
        <p className="text-gray-400 mt-1">Static Load Case</p>
      </div>

      <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-white">Load Case 목록</h2>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />업데이트됨</span>}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              새로고침
            </button>
            <button onClick={handleSave} disabled={saving || rows.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Save size={13} />
              {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

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
                      <input
                        value={r.NAME}
                        onChange={(e) => updateRow(idx, "NAME", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-1.5 pr-4">
                      <select
                        value={r.TYPE}
                        onChange={(e) => updateRow(idx, "TYPE", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {TYPE_OPTIONS.map(([code, label]) => (
                          <option key={code} value={code}>{label}</option>
                        ))}
                        {/* 매핑에 없는 TYPE인 경우 원본 표시 */}
                        {!TYPE_MAP[r.TYPE] && (
                          <option value={r.TYPE}>{r.TYPE}</option>
                        )}
                      </select>
                    </td>
                    <td className="py-1.5 pr-4">
                      <input
                        value={r.DESC}
                        onChange={(e) => updateRow(idx, "DESC", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => removeRow(idx)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mt-2">
          <Plus size={13} />
          Load Case 추가
        </button>
      </div>
    </div>
  );
}
