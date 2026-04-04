"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL, TestResult } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import FormField from "@/components/ui/FormField";
import { SavedBadge, AlertBanner } from "@/components/ui/StatusMessage";

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
    <SectionCard as="form" title="API 설정" onSubmit={handleSave}>
      <FormField label="Base URL">
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:8090" />
      </FormField>
      <FormField label="API Key">
        {maskedKey && !apiKey && (
          <p className="text-xs text-gray-500 mb-1">현재: <span className="font-mono">{maskedKey}</span></p>
        )}
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="새 API Key 입력 (변경 시에만)" />
      </FormField>
      {testResult && (
        <AlertBanner type={testResult.connected ? "success" : "error"} message={testResult.message} />
      )}
      <div className="flex items-center gap-3 pt-1">
        {saved && <SavedBadge />}
        <Button type="button" variant="secondary" size="xs" onClick={handleTest} disabled={testState === "loading"} loading={testState === "loading"}>
          연결 테스트
        </Button>
        <Button type="submit" size="xs" loading={saving} className="ml-auto">
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </SectionCard>
  );
}
