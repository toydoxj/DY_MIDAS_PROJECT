"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { BACKEND_URL, SelfWeightRow, StructureMass, LoadToMassData } from "@/lib/types";
import { authFetch } from "@/lib/auth";
import SectionCard from "@/components/ui/SectionCard";
import RefreshButton from "@/components/ui/RefreshButton";
import { ErrorText, SavedBadge } from "@/components/ui/StatusMessage";

export default function SelfWeightSection() {
  const [rows, setRows] = useState<SelfWeightRow[]>([]);
  const [massDat, setMassDat] = useState<StructureMass | null>(null);
  const [ltomDat, setLtomDat] = useState<LoadToMassData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 패널존 효과 (PZEF) — 모델 전체 1개 설정. offs_factor 표시/수정.
  const [pzId, setPzId] = useState<string>("1");
  const [pzRaw, setPzRaw] = useState<Record<string, unknown> | null>(null);
  const [pzInput, setPzInput] = useState<string>("");
  const [pzApplying, setPzApplying] = useState(false);
  const [pzSaved, setPzSaved] = useState(false);
  const [pzError, setPzError] = useState<string>("");
  const [pzShowRaw, setPzShowRaw] = useState(false);
  const [pzFactorKey, setPzFactorKey] = useState<string>("offs_factor");
  const [pzRootData, setPzRootData] = useState<unknown>(null);

  // offs_factor 우선순위 + 대소문자 무시 폴백.
  const FACTOR_KEY_CANDIDATES = [
    "offs_factor",
    "OFFS_FACTOR",
    "offsFactor",
    "Offs_Factor",
    "OFFSET_FACTOR",
    "FACTOR",
    "factor",
  ];

  const loadPanelZone = useCallback(async () => {
    setPzError("");
    try {
      const res = await authFetch(`${BACKEND_URL}/api/midas/db/PZEF`);
      if (!res.ok) {
        if (res.status === 404) {
          setPzRaw(null); setPzInput(""); setPzRootData(null);
          return;
        }
        throw new Error(`패널존 조회 실패 (${res.status})`);
      }
      const data = await res.json();
      setPzRootData(data);
      const root = data && typeof data === "object" && "PZEF" in data
        ? (data as Record<string, unknown>).PZEF : data;
      if (!root || typeof root !== "object") {
        setPzRaw(null); setPzInput("");
        return;
      }
      const map = root as Record<string, unknown>;
      const firstKey = Object.keys(map)[0];
      const first = firstKey && typeof map[firstKey] === "object"
        ? (map[firstKey] as Record<string, unknown>) : null;
      if (firstKey) setPzId(firstKey);
      setPzRaw(first);

      // offs_factor 추출 — (1) 우선순위 키 (2) 대소문자 무시 매칭 (3) 단일 number fallback
      let foundKey = "offs_factor";
      let value: number | null = null;
      if (first) {
        for (const k of FACTOR_KEY_CANDIDATES) {
          if (typeof first[k] === "number") { foundKey = k; value = first[k] as number; break; }
        }
        if (value == null) {
          const lcMap = Object.fromEntries(
            Object.entries(first).map(([k, v]) => [k.toLowerCase(), { k, v }]),
          );
          for (const c of FACTOR_KEY_CANDIDATES) {
            const hit = lcMap[c.toLowerCase()];
            if (hit && typeof hit.v === "number") {
              foundKey = hit.k; value = hit.v as number; break;
            }
          }
        }
        if (value == null) {
          const numEntries = Object.entries(first).filter(([, v]) => typeof v === "number");
          if (numEntries.length === 1) {
            foundKey = numEntries[0][0]; value = numEntries[0][1] as number;
          }
        }
      }
      setPzFactorKey(foundKey);
      setPzInput(value != null ? String(value) : "");
    } catch (e) {
      setPzError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const [swRes, massRes, ltomRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/selfweight`).catch(() => null),
        fetch(`${BACKEND_URL}/api/structure-mass`).catch(() => null),
        fetch(`${BACKEND_URL}/api/load-to-mass`).catch(() => null),
        loadPanelZone(),
      ]);
      if (swRes?.ok) setRows(await swRes.json());
      else if (swRes) setError(`자중 조회 오류: ${swRes.status}`);
      if (massRes?.ok) setMassDat(await massRes.json());
      if (ltomRes?.ok) setLtomDat(await ltomRes.json());
      if (!swRes && !massRes && !ltomRes) setError("백엔드 연결 실패");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // 활성 자동 판정: offs_factor==0 → OFF, 0<x<=1 → ON, 그 외 → 범위 외
  const pzNumber = parseFloat(pzInput);
  const pzEnabled =
    Number.isFinite(pzNumber) && pzNumber === 0
      ? false
      : Number.isFinite(pzNumber) && pzNumber > 0 && pzNumber <= 1.0
      ? true
      : null;
  const pzInputValid =
    Number.isFinite(pzNumber) && pzNumber >= 0 && pzNumber <= 1.0;
  const pzCurrentValue =
    pzRaw && typeof pzRaw[pzFactorKey] === "number"
      ? (pzRaw[pzFactorKey] as number)
      : null;
  const pzDirty =
    pzCurrentValue != null &&
    Number.isFinite(pzNumber) &&
    pzNumber !== pzCurrentValue;

  const applyPanelZone = useCallback(async () => {
    if (!pzInputValid) {
      setPzError("offs_factor는 0 이상 1.0 이하 값이어야 합니다");
      return;
    }
    setPzApplying(true);
    setPzError("");
    setPzSaved(false);
    try {
      // MIDAS API 표준 PUT 패턴: { Assign: { "<id>": { ...기존필드, <factorKey>: 값 } } }
      const merged: Record<string, unknown> = {
        ...(pzRaw ?? {}),
        [pzFactorKey]: pzNumber,
      };
      const body = { Assign: { [pzId]: merged } };
      const res = await authFetch(`${BACKEND_URL}/api/midas/db/PZEF`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`적용 실패 (${res.status})`);
      setPzSaved(true);
      setTimeout(() => setPzSaved(false), 2000);
      await loadPanelZone();
    } catch (e) {
      setPzError(e instanceof Error ? e.message : String(e));
    } finally {
      setPzApplying(false);
    }
  }, [pzId, pzFactorKey, pzInputValid, pzNumber, pzRaw, loadPanelZone]);

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Settings2 size={16} /> SETTING
        </h2>
        <RefreshButton onClick={fetchData} loading={loading} />
      </div>

      {error && <ErrorText message={error} />}

      {/* Structure Mass */}
      {massDat && (
        <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-blue-400">Structure Mass</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-gray-800/60 px-3 py-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Mass Type</span>
              <div className="text-white font-medium mt-0.5">{massDat.MASS_LABEL}</div>
            </div>
            <div className="rounded-md bg-gray-800/60 px-3 py-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Convert Mass</span>
              <div className="text-white font-medium mt-0.5">{massDat.SMASS_LABEL}</div>
            </div>
          </div>
        </div>
      )}

      {/* 자중입력 확인 */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">자중입력 확인</h3>
        {rows.length === 0 && !loading && !error && <p className="text-xs text-gray-500">데이터 없음</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead><tr className="border-b border-gray-600/50">
                <th className="pb-2 pr-4 font-medium text-gray-400">Load Case</th>
                <th className="pb-2 pr-4 font-medium text-gray-400 text-right">Factor</th>
                <th className="pb-2 font-medium text-gray-400 text-center w-10"></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-700/30 hover:bg-gray-600/20">
                    <td className="py-1.5 pr-4 text-white">{r.LCNAME}</td>
                    <td className="py-1.5 pr-4 text-gray-300 text-right">{r.factor !== null ? r.factor : "-"}</td>
                    <td className="py-1.5 text-center text-lg">{r.valid ? <span className="text-green-400">●</span> : <span className="text-red-400">●</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 패널존 효과 (Panel Zone Effects) — offs_factor 표시/수정 */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">패널존 효과 (Panel Zone Effects)</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={pzInput}
            onChange={(e) => setPzInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (pzDirty && pzInputValid && !pzApplying) void applyPanelZone();
              }
            }}
            placeholder="0.0 ~ 1.0"
            className="w-24 rounded-md bg-gray-800/60 border border-gray-600/50 px-2 py-1 text-xs text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
          />
          <span className="text-[10px] text-gray-500" title={`응답 키: ${pzFactorKey}`}>
            {pzFactorKey}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              pzEnabled === true
                ? "bg-green-500/20 text-green-400"
                : pzEnabled === false
                ? "bg-gray-600/40 text-gray-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
            title="0 → 활성 OFF, 0초과 1.0이하 → 활성 ON"
          >
            {pzEnabled === true ? "활성 ON" : pzEnabled === false ? "활성 OFF" : "범위 외"}
          </span>
          <button
            type="button"
            onClick={applyPanelZone}
            disabled={!pzDirty || !pzInputValid || pzApplying}
            className="ml-auto rounded-md bg-blue-500/80 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {pzApplying ? "적용 중..." : "적용"}
          </button>
          {pzSaved && <SavedBadge />}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>
            모델 전체 1개 설정 · 0=비활성, 0초과 1.0이하=활성
            {pzRaw == null && !pzError && " · (모델에 설정 없음)"}
          </span>
          {pzRootData != null && (
            <button
              type="button"
              onClick={() => setPzShowRaw((v) => !v)}
              className="underline hover:text-gray-300"
            >
              {pzShowRaw ? "원본 닫기" : "원본 보기"}
            </button>
          )}
        </div>
        {pzShowRaw && pzRootData != null && (
          <pre className="max-h-48 overflow-auto rounded border border-gray-600/50 bg-gray-900/60 p-2 text-[10px] text-gray-300">
{JSON.stringify(pzRootData, null, 2)}
          </pre>
        )}
        {pzError && <p className="text-[10px] text-red-400">{pzError}</p>}
      </div>

      {/* Loads to Masses */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">Loads to Masses</h3>
        {!ltomDat && !loading && <p className="text-xs text-gray-500">데이터 없음</p>}
        {ltomDat && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mass Direction</span>
                <div className="flex gap-1.5">
                  {(["X", "Y", "Z"] as const).map((d) => (
                    <span key={d} className={ltomDat[`DIR_${d}`] ? "text-green-400" : "text-gray-600"}>
                      {ltomDat[`DIR_${d}`] ? "\u2713" : "\u2717"}{d}
                    </span>
                  ))}
                </div>
              </div>
              <div />
              {([["bNODAL", "Nodal Load"], ["bBEAM", "Beam Load"], ["bFLOOR", "Floor Load"], ["bPRES", "Pressure"]] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className={ltomDat[key] ? "text-green-400" : "text-gray-600"}>{ltomDat[key] ? "\u2713" : "\u2717"}</span>
                </div>
              ))}
            </div>
            {ltomDat.vLC.length > 0 && (
              <div className="mt-2">
                <table className="w-full text-xs text-left">
                  <thead><tr className="border-b border-gray-600/50">
                    <th className="pb-1 pr-4 font-medium text-gray-400">Load Case</th>
                    <th className="pb-1 font-medium text-gray-400 text-right">Scale Factor</th>
                  </tr></thead>
                  <tbody>
                    {ltomDat.vLC.map((lc, i) => (
                      <tr key={i} className="border-b border-gray-700/30">
                        <td className="py-1 pr-4 text-white">{lc.LCNAME}</td>
                        <td className="py-1 text-gray-300 text-right">{lc.FACTOR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
