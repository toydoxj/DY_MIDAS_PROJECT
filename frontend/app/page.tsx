"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ── 타입 ──────────────────────────────────────────────────────────────
interface ProjectData {
  PROJECT: string;
  CLIENT: string;
  ADDRESS: string;
  COMMENT: string;
}

type TestResult = { connected: boolean; message: string } | null;

// ── 프로젝트 정보 섹션 ─────────────────────────────────────────────────
function ProjectSection() {
  const [data, setData] = useState<ProjectData>({ PROJECT: "", CLIENT: "", ADDRESS: "", COMMENT: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project`);
      const d = await r.json();
      setData({ PROJECT: d.PROJECT ?? "", CLIENT: d.CLIENT ?? "", ADDRESS: d.ADDRESS ?? "", COMMENT: d.COMMENT ?? "" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof ProjectData; label: string }[] = [
    { key: "COMMENT", label: "Project CODE" },
    { key: "PROJECT", label: "프로젝트명" },
    { key: "CLIENT",  label: "발주처" },
    { key: "ADDRESS", label: "주소" },
  ];

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">프로젝트 정보</h2>
        <button type="button" onClick={fetch_} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <input
              value={data[key]}
              onChange={(e) => setData((p) => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />업데이트됨</span>}
        <button type="submit" disabled={saving}
          className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
        </button>
      </div>
    </form>
  );
}

// ── 설정 섹션 ──────────────────────────────────────────────────────────
function SettingsSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "loading">("idle");
  const [testResult, setTestResult] = useState<TestResult>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/settings`).then((r) => r.json()).then((d) => {
      setBaseUrl(d.base_url ?? "");
      setMaskedKey(d.api_key_masked ?? "");
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const body: Record<string, string> = {};
    if (baseUrl) body.base_url = baseUrl;
    if (apiKey) body.api_key = apiKey;
    await fetch(`${BACKEND_URL}/api/settings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaved(true);
    setApiKey("");
    const res = await fetch(`${BACKEND_URL}/api/settings`);
    const d = await res.json();
    setMaskedKey(d.api_key_masked ?? "");
    setSaving(false);
  };

  const handleTest = async () => {
    setTestState("loading");
    setTestResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/test-connection`, { cache: "no-store" });
      setTestResult(await res.json());
    } catch (err) {
      setTestResult({ connected: false, message: String(err) });
    } finally {
      setTestState("idle");
    }
  };

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <h2 className="text-base font-semibold text-white mb-1">API 설정</h2>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:8090"
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
        {maskedKey && !apiKey && (
          <p className="text-xs text-gray-500 mb-1">현재: <span className="font-mono">{maskedKey}</span></p>
        )}
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password"
          placeholder="새 API Key 입력 (변경 시에만)"
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {testResult && (
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${testResult.connected ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"}`}>
          {testResult.connected
            ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
            : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
          <p className={`text-xs ${testResult.connected ? "text-green-300" : "text-red-300"}`}>{testResult.message}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />저장됨</span>}
        <button type="button" onClick={handleTest} disabled={testState === "loading"}
          className="flex items-center gap-1.5 rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50 transition-colors">
          {testState === "loading" && <Loader2 size={13} className="animate-spin" />}
          연결 테스트
        </button>
        <button type="submit" disabled={saving}
          className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

// ── 메인 대시보드 ──────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-gray-400 mt-1">MIDAS GEN NX API Dashboard</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProjectSection />
        <SettingsSection />
      </div>
    </div>
  );
}
