"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import FormField from "@/components/ui/FormField";
import { SavedBadge, AlertBanner } from "@/components/ui/StatusMessage";
import { BACKEND_URL } from "@/lib/types";

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
      const res = await fetch(`${BACKEND_URL}/api/settings`);
      const d = await res.json();
      setMaskedKey(d.api_key_masked ?? "");
    } catch (err) {
      setTestResult({ connected: false, message: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestState("loading");
    setTestResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/test-connection`, { cache: "no-store" });
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
      <PageHeader title="설정" subtitle="MIDAS GEN NX API 연결 정보를 입력합니다" />

      <SectionCard as="form" onSubmit={handleSave} className="space-y-4">
        <FormField label="Base URL">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:8090"
            className="py-2"
          />
        </FormField>

        <FormField label="API Key">
          {maskedKey && !apiKey && (
            <p className="text-xs text-gray-500 mb-1">
              현재 키: <span className="font-mono">{maskedKey}</span>
            </p>
          )}
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="새 API Key 입력 (변경 시에만)"
            className="py-2"
          />
        </FormField>

        {saved && <SavedBadge label="저장되었습니다" />}

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={saving}>
            저장
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            loading={testState === "loading"}
          >
            연결 테스트
          </Button>
        </div>
      </SectionCard>

      {testResult && (
        <AlertBanner
          type={testResult.connected ? "success" : "error"}
          message={testResult.message}
        />
      )}
    </div>
  );
}
