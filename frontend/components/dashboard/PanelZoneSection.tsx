"use client";

import { useEffect, useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/types";
import { authFetch } from "@/lib/auth";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Loader2, RefreshCw } from "lucide-react";

interface PanelZoneInfo {
  enabled: boolean;
  factor: number | null;
  raw: Record<string, unknown> | null;
}

// MIDAS PZEF 응답 첫 항목에서 활성/factor 자동 추출 — 필드명 변형에 robust.
function parsePZEF(data: unknown): PanelZoneInfo {
  if (!data || typeof data !== "object")
    return { enabled: false, factor: null, raw: null };
  const root = (data as Record<string, unknown>).PZEF ?? data;
  if (!root || typeof root !== "object")
    return { enabled: false, factor: null, raw: null };
  const entries = Object.values(root as Record<string, unknown>);
  const first = entries.find((v) => v && typeof v === "object") as
    | Record<string, unknown>
    | undefined;
  if (!first) return { enabled: false, factor: null, raw: null };

  // 활성화: 우선순위 키 → boolean 1개 자동 검출
  const ENABLE_KEYS = [
    "bPZEFFECT",
    "bPZE",
    "bPanelZone",
    "ENABLED",
    "bENABLE",
  ];
  let enabled = false;
  for (const k of ENABLE_KEYS) {
    if (typeof first[k] === "boolean") {
      enabled = first[k] as boolean;
      break;
    }
  }
  if (!enabled) {
    const bools = Object.values(first).filter((v) => typeof v === "boolean");
    if (bools.length === 1) enabled = bools[0] as boolean;
  }

  // factor: 우선순위 키 → number 1개 자동 검출
  const FACTOR_KEYS = ["RFACTOR", "FACTOR", "RFAC", "RIGID_FACTOR"];
  let factor: number | null = null;
  for (const k of FACTOR_KEYS) {
    if (typeof first[k] === "number") {
      factor = first[k] as number;
      break;
    }
  }
  if (factor == null) {
    const nums = Object.values(first).filter(
      (v) => typeof v === "number",
    ) as number[];
    if (nums.length === 1) factor = nums[0];
  }

  return { enabled, factor, raw: first };
}

export default function PanelZoneSection() {
  const [info, setInfo] = useState<PanelZoneInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${BACKEND_URL}/api/midas/db/PZEF`);
      if (!res.ok) {
        // PZEF 미설정 시 일부 MIDAS 응답이 404 → 비활성으로 표시.
        if (res.status === 404) {
          setInfo({ enabled: false, factor: null, raw: null });
          return;
        }
        throw new Error(`조회 실패 (${res.status})`);
      }
      setInfo(parsePZEF(await res.json()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <SectionCard
      title="패널존 효과 (Panel Zone Effects)"
      action={
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={reload}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={12} />
          ) : (
            <RefreshCw size={12} />
          )}
          새로고침
        </Button>
      }
    >
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && info && (
        <div className="space-y-2">
          <Row label="활성화">
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                info.enabled
                  ? "bg-[#669900]/20 text-[#8cbf2d]"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {info.enabled ? "ON" : "OFF"}
            </span>
          </Row>
          <Row label="Factor">
            <span className="font-mono text-sm text-gray-700">
              {info.factor != null ? info.factor.toFixed(3) : "—"}
            </span>
          </Row>
          {info.raw && (
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-[10px] text-gray-500 hover:text-gray-700 underline"
            >
              {showRaw ? "원본 닫기" : "원본 보기"}
            </button>
          )}
          {showRaw && info.raw && (
            <pre className="mt-2 max-h-48 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-[10px] text-gray-700">
              {JSON.stringify(info.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
      {!error && !info && !loading && (
        <p className="text-xs text-gray-500">조회 중...</p>
      )}
    </SectionCard>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  );
}
