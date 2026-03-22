"use client";

import { useEffect, useState } from "react";
import { CheckCircle, RefreshCw } from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const FIELDS = [
  { key: "PROJECT", label: "프로젝트명", placeholder: "프로젝트명을 입력하세요" },
  { key: "CLIENT",  label: "발주처",     placeholder: "발주처를 입력하세요" },
  { key: "ADDRESS", label: "주소",       placeholder: "주소를 입력하세요" },
  { key: "COMMENT", label: "비고",       placeholder: "비고를 입력하세요" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type FormData = Record<FieldKey, string>;

const empty = (): FormData =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as FormData;

export default function ProjectPage() {
  const [form, setForm] = useState<FormData>(empty());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fetchFromMidas = async () => {
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setForm(
        Object.fromEntries(FIELDS.map((f) => [f.key, d[f.key] ?? ""])) as FormData
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFromMidas();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const r = await fetch(`${BACKEND_URL}/api/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "업데이트 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white">프로젝트 정보</h1>
        <p className="text-gray-400 mt-1">MIDAS GEN NX에서 프로젝트 정보를 가져옵니다</p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-4"
      >
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {label}
            </label>
            <input
              value={form[key]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [key]: e.target.value }))
              }
              placeholder={placeholder}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        {saved && (
          <p className="text-sm text-green-400 flex items-center gap-1.5">
            <CheckCircle size={15} /> MIDAS에 업데이트되었습니다
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={fetchFromMidas}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
          </button>
        </div>
      </form>
    </div>
  );
}
