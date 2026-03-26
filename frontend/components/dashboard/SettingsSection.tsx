"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { BACKEND_URL, TestResult } from "@/lib/types";

export default function SettingsSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "loading">("idle");
  const [testResult, setTestResult] = useState<TestResult>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/settings`).then((r) => r.json()).then((d) => {
      setBaseUrl(d.base_url ?? ""); setMaskedKey(d.api_key_masked ?? "");
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;
      const saveRes = await fetch(`${BACKEND_URL}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!saveRes.ok) throw new Error(`저장 실패: ${saveRes.status}`);
      setSaved(true); setApiKey("");
      const res = await fetch(`${BACKEND_URL}/api/settings`);
      if (res.ok) { const d = await res.json(); setMaskedKey(d.api_key_masked ?? ""); }
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTestState("loading"); setTestResult(null);
    try { const res = await fetch(`${BACKEND_URL}/api/test-connection`, { cache: "no-store" }); setTestResult(await res.json()); }
    catch (err) { setTestResult({ connected: false, message: String(err) }); }
    finally { setTestState("idle"); }
  };

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <h2 className="text-base font-semibold text-white mb-1">API 설정</h2>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:8090"
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
        {maskedKey && !apiKey && <p className="text-xs text-gray-500 mb-1">현재: <span className="font-mono">{maskedKey}</span></p>}
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="새 API Key 입력 (변경 시에만)"
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {testResult && (
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${testResult.connected ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"}`}>
          {testResult.connected ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" /> : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
          <p className={`text-xs ${testResult.connected ? "text-green-300" : "text-red-300"}`}>{testResult.message}</p>
        </div>
      )}
      <div className="flex items-center gap-3 pt-1">
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />저장됨</span>}
        <button type="button" onClick={handleTest} disabled={testState === "loading"}
          className="flex items-center gap-1.5 rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50 transition-colors">
          {testState === "loading" && <Loader2 size={13} className="animate-spin" />} 연결 테스트
        </button>
        <button type="submit" disabled={saving} className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}
