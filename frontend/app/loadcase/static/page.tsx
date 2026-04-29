"use client";

import { useEffect, useState } from "react";
import { Save, Plus, Trash2, ListPlus } from "lucide-react";
import { BACKEND_URL } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import RefreshButton from "@/components/ui/RefreshButton";
import { SavedBadge, ErrorText } from "@/components/ui/StatusMessage";

const TYPE_MAP: Record<string, string> = {
  D: "Dead Load",
  L: "Live Load",
  LR: "Roof Live Load",
  W: "Wind Load",
  WA: "Wind Load (Across)",
  ES: "Earthquake (Static)",
  EH: "Earth Pressure",
};
const TYPE_OPTIONS = Object.entries(TYPE_MAP);

interface LoadCaseRow {
  id: string;
  NAME: string;
  TYPE: string;
  DESC: string;
}

interface PresetCase {
  NAME: string;
  TYPE: string;
  DESC: string;
}

// docs/Setting_Static_Load_Case.md 의 Type 1~4 프리셋.
// MIDAS Gen Static Load Case Type 코드:
//  D=Dead, L=Live, LR=Roof Live, W=Wind, ES=Earthquake(Static), EH=Earth Pressure
const PRESETS: Record<string, { label: string; cases: PresetCase[] }> = {
  type1: {
    label: "Type 1 — 기본",
    cases: [
      { NAME: "DL", TYPE: "D", DESC: "Dead Load" },
      { NAME: "LL", TYPE: "L", DESC: "Live Load" },
      { NAME: "Lr", TYPE: "LR", DESC: "Roof Live Load" },
      { NAME: "Wx", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wy", TYPE: "W", DESC: "Wind Load Y direction" },
    ],
  },
  type2: {
    label: "Type 2 — 기본 (등가정적법)",
    cases: [
      { NAME: "DL", TYPE: "D", DESC: "Dead Load" },
      { NAME: "LL", TYPE: "L", DESC: "Live Load" },
      { NAME: "Lr", TYPE: "LR", DESC: "Roof Live Load" },
      { NAME: "Wx", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wy", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "Ex", TYPE: "ES", DESC: "Seismic Load X direction" },
      { NAME: "Ey", TYPE: "ES", DESC: "Seismic Load Y direction" },
    ],
  },
  type3: {
    label: "Type 3 — 기본 (지하내진포함)",
    cases: [
      { NAME: "DL", TYPE: "D", DESC: "Dead Load" },
      { NAME: "LL", TYPE: "L", DESC: "Live Load" },
      { NAME: "Lr", TYPE: "LR", DESC: "Roof Live Load" },
      { NAME: "Wx", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wy", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "EHx+", TYPE: "EH", DESC: "Horizontal Earth Pressure X+ Direction" },
      { NAME: "EHx-", TYPE: "EH", DESC: "Horizontal Earth Pressure X- Direction" },
      { NAME: "EHy+", TYPE: "EH", DESC: "Horizontal Earth Pressure Y+ Direction" },
      { NAME: "EHy-", TYPE: "EH", DESC: "Horizontal Earth Pressure Y- Direction" },
      { NAME: "EEPx+", TYPE: "ES", DESC: "Earthquake Earth Pressure X+ Direction" },
      { NAME: "EEPx-", TYPE: "ES", DESC: "Earthquake Earth Pressure X- Direction" },
      { NAME: "EEPy+", TYPE: "ES", DESC: "Earthquake Earth Pressure Y+ Direction" },
      { NAME: "EEPy-", TYPE: "ES", DESC: "Earthquake Earth Pressure Y- Direction" },
    ],
  },
  type4: {
    label: "Type 4 — 경량 쉘터 (등가정적법)",
    cases: [
      { NAME: "DL", TYPE: "D", DESC: "Dead Load" },
      { NAME: "LL", TYPE: "L", DESC: "Live Load" },
      { NAME: "Lr", TYPE: "LR", DESC: "Roof Live Load" },
      { NAME: "Wx+1", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wx+2", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wx-1", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wx-2", TYPE: "W", DESC: "Wind Load X direction" },
      { NAME: "Wy+1", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "Wy+2", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "Wy-1", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "Wy-2", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "Wy", TYPE: "W", DESC: "Wind Load Y direction" },
      { NAME: "Ex", TYPE: "ES", DESC: "Seismic Load X direction" },
      { NAME: "Ey", TYPE: "ES", DESC: "Seismic Load Y direction" },
    ],
  },
};

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

  // 프리셋 불러오기 — 기존 케이스 있으면 confirm 후 교체 + 즉시 MIDAS PUT.
  const applyPreset = async (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    if (rows.length > 0) {
      const ok = window.confirm(
        `기존 Static Load Case ${rows.length}개가 있습니다.\n[${preset.label}](${preset.cases.length}개)으로 교체하시겠습니까?`,
      );
      if (!ok) return;
    }
    const newRows: LoadCaseRow[] = preset.cases.map((c, i) => ({
      id: String(i + 1),
      NAME: c.NAME,
      TYPE: c.TYPE,
      DESC: c.DESC,
    }));
    setRows(newRows);
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/loadcase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRows),
      });
      if (!res.ok) throw new Error(`프리셋 적용 실패: ${res.status}`);
      setSaved(true);
      // MIDAS가 normalize한 실제 응답으로 다시 동기화
      await fetchData();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const headerAction = (
    <>
      {saved && <SavedBadge label="업데이트됨" />}
      <div className="relative inline-flex items-center">
        <ListPlus size={13} className="absolute left-2 text-gray-400 pointer-events-none" />
        <select
          value=""
          disabled={saving || loading}
          onChange={(e) => {
            const k = e.target.value;
            e.currentTarget.value = "";
            if (k) void applyPreset(k);
          }}
          className="appearance-none bg-gray-700 border border-gray-600 rounded pl-7 pr-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          title="프리셋(docs/Setting_Static_Load_Case.md) 불러오기"
        >
          <option value="">프리셋 불러오기...</option>
          {Object.entries(PRESETS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label} ({p.cases.length}개)
            </option>
          ))}
        </select>
      </div>
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
