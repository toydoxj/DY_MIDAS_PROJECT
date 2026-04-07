"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL, TestResult } from "@/lib/types";
import { authFetch } from "@/lib/auth";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import FormField from "@/components/ui/FormField";
import { SavedBadge, AlertBanner } from "@/components/ui/StatusMessage";

declare global {
  interface Window {
    electronAPI?: { isElectron: boolean; browseFolder: (currentPath: string) => Promise<string | null> };
  }
}

export default function SettingsSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "loading">("idle");
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [workDir, setWorkDir] = useState("");
  const [workDirInput, setWorkDirInput] = useState("");
  const [workDirSaved, setWorkDirSaved] = useState(false);
  const [workDirError, setWorkDirError] = useState("");

  useEffect(() => {
    authFetch(`${BACKEND_URL}/api/settings`).then((r) => r.json()).then((d) => {
      setBaseUrl(d.base_url ?? ""); setMaskedKey(d.api_key_masked ?? "");
    }).catch(() => {});
    authFetch(`${BACKEND_URL}/api/work-dir`).then((r) => r.json()).then((d) => {
      setWorkDir(d.path ?? ""); setWorkDirInput(d.path ?? "");
      setWorkDirError(d.error ?? "");
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;
      const saveRes = await authFetch(`${BACKEND_URL}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!saveRes.ok) throw new Error(`저장 실패: ${saveRes.status}`);
      setSaved(true); setApiKey("");
      const res = await authFetch(`${BACKEND_URL}/api/settings`);
      if (res.ok) { const d = await res.json(); setMaskedKey(d.api_key_masked ?? ""); }
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTestState("loading"); setTestResult(null);
    try { const res = await authFetch(`${BACKEND_URL}/api/test-connection`, { cache: "no-store" }); setTestResult(await res.json()); }
    catch (err) { setTestResult({ connected: false, message: String(err) }); }
    finally { setTestState("idle"); }
  };

  const [workDirBrowsing, setWorkDirBrowsing] = useState(false);
  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.browseFolder;

  const handleWorkDirBrowse = async () => {
    setWorkDirBrowsing(true);
    try {
      const folder = await window.electronAPI!.browseFolder(workDir);
      if (folder) {
        setWorkDirInput(folder);
        const res = await authFetch(`${BACKEND_URL}/api/work-dir`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: folder }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.path) { setWorkDir(d.path); setWorkDirInput(d.path); setWorkDirError(""); setWorkDirSaved(true); setTimeout(() => setWorkDirSaved(false), 2000); }
        }
      }
    } catch { /* ignore */ }
    finally { setWorkDirBrowsing(false); }
  };

  const handleWorkDirSave = async () => {
    if (!workDirInput || workDirInput === workDir) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/work-dir`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: workDirInput }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.path) { setWorkDir(d.path); setWorkDirSaved(true); setTimeout(() => setWorkDirSaved(false), 2000); }
      }
    } catch { /* ignore */ }
  };

  return (
    <SectionCard as="form" title="API 설정" onSubmit={handleSave}>
      <FormField label="작업 폴더">
        <div className="flex gap-2">
          <Input value={workDirInput} onChange={(e) => setWorkDirInput(e.target.value)} placeholder="C:\Users\...\MIDAS_Dashboard" className="flex-1" />
          {isElectron && (
            <Button type="button" variant="outline" size="xs" onClick={handleWorkDirBrowse} disabled={workDirBrowsing}>
              {workDirBrowsing ? "선택 중..." : "폴더 선택"}
            </Button>
          )}
          <Button type="button" variant="outline" size="xs" onClick={handleWorkDirSave} disabled={!workDirInput || workDirInput === workDir}>
            적용
          </Button>
        </div>
        {workDirSaved && <p className="text-[10px] text-green-500 mt-1">저장됨</p>}
        {workDirError && <p className="text-[10px] text-red-400 mt-1">{workDirError}</p>}
        {workDir && !workDirError && <p className="text-[10px] text-gray-500 mt-1">현재: {workDir}</p>}
      </FormField>
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
        <Button type="button" variant="outline" size="xs" onClick={handleTest} disabled={testState === "loading"} loading={testState === "loading"}>
          연결 테스트
        </Button>
        <Button type="submit" size="xs" loading={saving} className="ml-auto">
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </SectionCard>
  );
}
