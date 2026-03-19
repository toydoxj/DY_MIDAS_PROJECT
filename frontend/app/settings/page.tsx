"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type TestResult = { connected: boolean; message: string } | null;
type TestState = "idle" | "loading";

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testResult, setTestResult] = useState<TestResult>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/settings`)
      .then((r) => r.json())
      .then((d) => {
        setBaseUrl(d.base_url ?? "");
        setMaskedKey(d.api_key_masked ?? "");
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      const body: Record<string, string> = {};
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaved(true);
      setApiKey("");
      // 저장 후 masked key 갱신
      const res = await fetch(`${BACKEND_URL}/api/settings`);
      const d = await res.json();
      setMaskedKey(d.api_key_masked ?? "");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestState("loading");
    setTestResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/test-connection`, {
        cache: "no-store",
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ connected: false, message: String(err) });
    } finally {
      setTestState("idle");
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-gray-400 mt-1">MIDAS GEN NX API 연결 정보를 입력합니다</p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-4"
      >
        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Base URL
          </label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:8090"
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            API Key
          </label>
          {maskedKey && !apiKey && (
            <p className="text-xs text-gray-500 mb-1">
              현재 키: <span className="font-mono">{maskedKey}</span>
            </p>
          )}
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="새 API Key 입력 (변경 시에만)"
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 저장 완료 메시지 */}
        {saved && (
          <p className="text-sm text-green-400 flex items-center gap-1.5">
            <CheckCircle size={15} /> 저장되었습니다
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testState === "loading"}
            className="rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {testState === "loading" && <Loader2 size={14} className="animate-spin" />}
            연결 테스트
          </button>
        </div>
      </form>

      {/* 테스트 결과 */}
      {testResult && (
        <div
          className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
            testResult.connected
              ? "bg-green-900/30 border-green-700"
              : "bg-red-900/30 border-red-700"
          }`}
        >
          {testResult.connected ? (
            <CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <p className={`text-sm ${testResult.connected ? "text-green-300" : "text-red-300"}`}>
            {testResult.message}
          </p>
        </div>
      )}
    </div>
  );
}
