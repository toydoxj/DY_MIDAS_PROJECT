"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Save, Download, Undo2 } from "lucide-react";
import { BACKEND_URL } from "@/lib/types";

// ── 타입 ──────────────────────────────────────────────────────────────
interface FinishRow {
  material: string;
  density: string;
  thickness: string;
  load: string;
}

interface FloorLoadEntry {
  id: number;
  floor: string;
  roomName: string;
  desc: string;
  finishes: FinishRow[];
  slabType: string;
  slabThickness: string;
  slabLoad: string;
  usageCategory: string;
  usageDetail: string;
  liveLoad: string;
}

// ── 초기값 ─────────────────────────────────────────────────────────────
const emptyFinish = (): FinishRow => ({ material: "", density: "", thickness: "", load: "" });

const emptyEntry = (id: number): FloorLoadEntry => ({
  id, floor: "", roomName: "", desc: "",
  finishes: [emptyFinish(), emptyFinish(), emptyFinish(), emptyFinish(), emptyFinish(), emptyFinish()],
  slabType: "없음", slabThickness: "", slabLoad: "",
  usageCategory: "", usageDetail: "", liveLoad: "",
});

const SLAB_OPTIONS = ["없음", "철근콘크리트 슬래브", "트러스형 데크슬래브", "골형 데크슬래브"];

// 슬래브 하중 자동 계산 (kN/m², 두께 mm 입력)
function calcSlabLoad(type: string, thickness: string): string {
  const t = parseFloat(thickness);
  if (isNaN(t) || t <= 0) return "";
  switch (type) {
    case "철근콘크리트 슬래브": return ((t / 1000) * 24).toFixed(2);         // t(mm) × 24 kN/m³
    case "트러스형 데크슬래브":  return ((t / 1000) * 23 + 0.25).toFixed(2);  // t(mm) × 23 + 250 N/m²
    case "골형 데크슬래브":     return ((t / 1000) * 18).toFixed(2);          // t(mm) × 18 kN/m³
    default: return "";
  }
}

interface KdsLiveLoad {
  category: string;
  detail: string;
  load: string;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────
export default function FloorLoadPage() {
  const [entries, setEntries] = useState<FloorLoadEntry[]>([]);
  const [current, setCurrent] = useState<FloorLoadEntry>(emptyEntry(1));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [kdsData, setKdsData] = useState<KdsLiveLoad[]>([]);

  // Undo 히스토리
  const historyRef = useRef<FloorLoadEntry[][]>([]);
  const MAX_HISTORY = 50;

  const pushHistory = useCallback((prev: FloorLoadEntry[]) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), JSON.parse(JSON.stringify(prev))];
  }, []);

  const setEntriesWithHistory = useCallback((updater: FloorLoadEntry[] | ((prev: FloorLoadEntry[]) => FloorLoadEntry[])) => {
    setEntries((prev) => {
      pushHistory(prev);
      return typeof updater === "function" ? updater(prev) : updater;
    });
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    setEntries(prev);
    setSelectedIdx(null);
    setCurrent(emptyEntry(1));
  }, []);

  // KDS 데이터 및 저장 데이터 로드
  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/kds-live-loads`).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/floor-loads`).then((r) => r.json()),
    ]).then(([kds, floors]) => {
      if (Array.isArray(kds)) setKdsData(kds);
      if (Array.isArray(floors) && floors.length > 0) setEntries(floors);
    }).catch(() => {});
  }, []);

  // KDS에서 카테고리 목록 추출
  const kdsCategories = [...new Set(kdsData.map((d) => d.category))];
  const kdsDetails = (cat: string) => kdsData.filter((d) => d.category === cat);

  // 서버에 저장
  const handleSaveAll = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/floor-loads`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entries),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaved(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  // 하중표 만들기 (Excel 다운로드)
  const handleExportExcel = async () => {
    await handleSaveAll();
    try {
      const res = await fetch(`${BACKEND_URL}/api/floor-loads/export-excel`);
      if (!res.ok) { const d = await res.json(); alert(d.detail || "내보내기 실패"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "floor_load_table.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(String(e)); }
  };

  // MIDAS 동기화
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSyncMidas = async () => {
    if (entries.length === 0) return;
    // 저장 먼저 실행
    await handleSaveAll();
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/floor-loads/sync-midas`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "동기화 실패");
      setSyncResult({ ok: true, msg: `${data.count}개 항목 동기화 완료` });
    } catch (e) {
      setSyncResult({ ok: false, msg: String(e) });
    } finally { setSyncing(false); }
  };

  // 서버에서 불러오기
  const handleLoadAll = async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/floor-loads`);
      const data = await r.json();
      if (Array.isArray(data)) { setEntries(data); setSelectedIdx(null); setCurrent(emptyEntry(1)); }
    } catch { /* ignore */ }
  };

  // 마감하중 합계
  const finishTotal = current.finishes.reduce((sum, r) => {
    const v = parseFloat(r.load);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const slabLoadNum = parseFloat(current.slabLoad) || 0;
  const deadLoad = finishTotal + slabLoadNum;
  const liveLoadNum = parseFloat(current.liveLoad) || 0;

  // 마감하중 행 업데이트
  const updateFinish = (idx: number, field: keyof FinishRow, value: string) => {
    setCurrent((prev) => {
      const finishes = [...prev.finishes];
      finishes[idx] = { ...finishes[idx], [field]: value };
      // 밀도/두께 입력 시 하중 자동 계산
      if (field === "density" || field === "thickness") {
        const d = parseFloat(field === "density" ? value : finishes[idx].density);
        const t = parseFloat(field === "thickness" ? value : finishes[idx].thickness);
        if (!isNaN(d) && !isNaN(t) && t > 0) {
          finishes[idx].load = (d * t / 1000).toFixed(2);
        }
      }
      return { ...prev, finishes };
    });
  };

  // 용도 카테고리 변경
  const handleCategoryChange = (cat: string) => {
    const details = kdsDetails(cat);
    const first = details[0];
    setCurrent((p) => ({ ...p, usageCategory: cat, usageDetail: first?.detail ?? "", liveLoad: first?.load ?? "0" }));
  };

  const handleDetailChange = (detail: string) => {
    const found = kdsData.find((d) => d.category === current.usageCategory && d.detail === detail);
    const loadVal = found?.load ?? "0";
    // 숫자가 아닌 값(비고 등)은 그대로 표시하되 직접 입력 유도
    const numLoad = parseFloat(loadVal);
    setCurrent((p) => ({ ...p, usageDetail: detail, liveLoad: isNaN(numLoad) ? "" : String(numLoad) }));
  };

  // CRUD
  const handleRegister = () => {
    const id = entries.length > 0 ? Math.max(...entries.map((e) => e.id)) + 1 : 1;
    setEntriesWithHistory((prev) => [...prev, { ...current, id }]);
    setSelectedIdx(null);
  };

  const handleUpdate = () => {
    if (selectedIdx === null) return;
    setEntriesWithHistory((prev) => prev.map((e, i) => i === selectedIdx ? { ...current, id: e.id } : e));
  };

  const handleDelete = () => {
    if (selectedIdx === null) return;
    const target = entries[selectedIdx];
    const label = target.floor ? `${target.floor} - ${target.roomName}` : `항목 #${selectedIdx + 1}`;
    if (!window.confirm(`"${label}" 항목을 삭제하시겠습니까?`)) return;
    setEntriesWithHistory((prev) => prev.filter((_, i) => i !== selectedIdx));
    setCurrent(emptyEntry(1));
    setSelectedIdx(null);
  };

  const handleReset = () => {
    setCurrent(emptyEntry(1));
    setSelectedIdx(null);
  };

  const selectEntry = (idx: number) => {
    setSelectedIdx(idx);
    setCurrent({ ...entries[idx] });
  };

  // 테이블 행 이동
  const moveEntry = (from: number, to: number) => {
    if (to < 0 || to >= entries.length) return;
    setEntriesWithHistory((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    setSelectedIdx(to);
  };

  // Ctrl+Z 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo]);

  const inputCls = "w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500";
  const selectCls = "w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "rounded bg-gray-600 px-3 py-1.5 text-xs font-semibold text-blue-300 text-center whitespace-nowrap";
  const btnCls = "rounded-lg px-4 py-1.5 text-xs font-medium transition-colors";

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/loadcase" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Floor Load</h1>
          <p className="text-gray-400 mt-1">바닥 하중 산정</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ── 좌측: 입력 폼 ──────────────────────────────────── */}
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-4">
          {/* 층수 / 실명 */}
          <div className="grid grid-cols-[80px_1fr_80px_2fr] gap-2 items-center">
            <span className={labelCls}>층수</span>
            <input value={current.floor} onChange={(e) => setCurrent((p) => ({ ...p, floor: e.target.value }))} placeholder="ex) 2F" className={inputCls} />
            <span className={labelCls}>실명</span>
            <input value={current.roomName} onChange={(e) => setCurrent((p) => ({ ...p, roomName: e.target.value }))} placeholder="ex) 거실" className={inputCls} />
          </div>

          {/* 마감하중 */}
          <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
            <h3 className="text-xs font-semibold text-blue-400">마감하중</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="pb-1.5 pr-2 text-left text-gray-400 font-medium w-32">재료마감</th>
                  <th className="pb-1.5 pr-2 text-left text-gray-400 font-medium w-24">밀도(kN/m³)</th>
                  <th className="pb-1.5 pr-2 text-left text-gray-400 font-medium w-24">두께(mm)</th>
                  <th className="pb-1.5 text-right text-gray-400 font-medium w-28">하중(kN/m²)</th>
                </tr>
              </thead>
              <tbody>
                {current.finishes.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2"><input value={row.material} onChange={(e) => updateFinish(i, "material", e.target.value)} className={inputCls} /></td>
                    <td className="py-1 pr-2"><input value={row.density} onChange={(e) => updateFinish(i, "density", e.target.value)} className={inputCls} /></td>
                    <td className="py-1 pr-2"><input value={row.thickness} onChange={(e) => updateFinish(i, "thickness", e.target.value)} className={inputCls} /></td>
                    <td className="py-1"><input
                      value={row.load}
                      onChange={(e) => updateFinish(i, "load", e.target.value)}
                      placeholder="-"
                      className={`${inputCls} text-right ${row.density && row.thickness ? "bg-gray-600/50" : ""}`}
                    /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-600/50">
                  <td colSpan={3} className="py-1.5 text-right text-gray-400 pr-2 font-medium">합계</td>
                  <td className="py-1.5">
                    <div className="rounded bg-gray-600/80 px-2 py-1.5 text-sm text-white text-right font-medium">{finishTotal.toFixed(2)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 슬래브 */}
          <div className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center">
            <span className={labelCls}>슬래브</span>
            <select value={current.slabType} onChange={(e) => {
              const type = e.target.value;
              setCurrent((p) => ({ ...p, slabType: type, slabLoad: type === "없음" ? "" : calcSlabLoad(type, p.slabThickness) }));
            }} className={selectCls}>
              {SLAB_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input value={current.slabThickness} onChange={(e) => {
              const thickness = e.target.value;
              setCurrent((p) => ({ ...p, slabThickness: thickness, slabLoad: p.slabType === "없음" ? "" : calcSlabLoad(p.slabType, thickness) }));
            }} placeholder="두께(mm)" disabled={current.slabType === "없음"} className={`${inputCls} disabled:opacity-40`} />
            <input value={current.slabLoad} onChange={(e) => setCurrent((p) => ({ ...p, slabLoad: e.target.value }))}
              placeholder="-" disabled={current.slabType === "없음"} className={`${inputCls} w-28 text-right disabled:opacity-40`} />
          </div>

          {/* 용도 */}
          <div className="grid grid-cols-[80px_auto_1fr_80px] gap-2 items-center">
            <span className={labelCls}>용도</span>
            <select value={current.usageCategory} onChange={(e) => handleCategoryChange(e.target.value)} className={selectCls}>
              {kdsCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={current.usageDetail} onChange={(e) => handleDetailChange(e.target.value)} className={selectCls}>
              {kdsDetails(current.usageCategory).map((d) => <option key={d.detail}>{d.detail}</option>)}
            </select>
            <input value={current.liveLoad} onChange={(e) => setCurrent((p) => ({ ...p, liveLoad: e.target.value }))}
              placeholder="직접 입력" className={`${inputCls} text-center`} />
          </div>

          {/* 하중 요약 */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="rounded-md bg-gray-700/60 px-3 py-2 text-center">
              <span className="text-gray-500 block text-[10px]">고정하중 (D)</span>
              <span className="text-white font-medium">{deadLoad.toFixed(2)}</span>
            </div>
            <div className="rounded-md bg-gray-700/60 px-3 py-2 text-center">
              <span className="text-gray-500 block text-[10px]">활하중 (L)</span>
              <span className="text-white font-medium">{liveLoadNum.toFixed(2)}</span>
            </div>
            <div className="rounded-md bg-gray-700/60 px-3 py-2 text-center">
              <span className="text-gray-500 block text-[10px]">D + L</span>
              <span className="text-white font-medium">{(deadLoad + liveLoadNum).toFixed(2)}</span>
            </div>
            <div className="rounded-md bg-blue-900/40 border border-blue-700/30 px-3 py-2 text-center">
              <span className="text-blue-400/70 block text-[10px]">1.2D + 1.6L</span>
              <span className="text-blue-300 font-medium">{(1.2 * deadLoad + 1.6 * liveLoadNum).toFixed(2)}</span>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
            <button onClick={handleRegister} className={`${btnCls} px-5 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700`}>등록</button>
            <button onClick={handleUpdate} disabled={selectedIdx === null} className={`${btnCls} px-5 py-2 text-sm bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40`}>수정</button>
            <button onClick={handleDelete} disabled={selectedIdx === null} className={`${btnCls} px-5 py-2 text-sm bg-gray-700 text-red-400 hover:bg-red-900/30 disabled:opacity-40`}>삭제</button>
            <button onClick={handleUndo} disabled={historyRef.current.length === 0}
              className={`${btnCls} bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 flex items-center gap-1`}>
              <Undo2 size={12} /> 되돌리기
            </button>
            <div className="flex-1" />
            <button className={`${btnCls} bg-gray-700 text-gray-300 hover:bg-gray-600`}>계단하중입력</button>
            <button onClick={handleReset} className={`${btnCls} bg-gray-700 text-gray-300 hover:bg-gray-600`}>입력창 초기화</button>
          </div>
        </div>

        {/* ── 우측: 등록 목록 테이블 ────────────────────────── */}
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
          {/* 액션 버튼 */}
          <div className="flex items-center gap-3 pb-2 border-b border-gray-700">
            <button onClick={handleSaveAll} disabled={saving || entries.length === 0}
              className={`${btnCls} bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 flex items-center gap-1.5`}>
              <Save size={13} /> {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={handleLoadAll}
              className={`${btnCls} bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center gap-1.5`}>
              <Download size={13} /> 불러오기
            </button>
            {saved && <span className="text-xs text-green-400">저장됨</span>}
            {syncResult && <span className={`text-xs ${syncResult.ok ? "text-green-400" : "text-red-400"}`}>{syncResult.msg}</span>}
            <div className="flex-1" />
            <button onClick={handleExportExcel} disabled={entries.length === 0}
              className={`${btnCls} bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40`}>하중표만들기</button>
            <button onClick={handleSyncMidas} disabled={syncing || entries.length === 0}
              className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40`}>
              {syncing ? "동기화 중..." : "MIDAS 동기화"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">등록 목록</h2>
            {selectedIdx !== null && (
              <div className="flex gap-1">
                <button onClick={() => moveEntry(selectedIdx, 0)} className="text-gray-400 hover:text-white p-1"><ChevronsUp size={14} /></button>
                <button onClick={() => moveEntry(selectedIdx, selectedIdx - 1)} className="text-gray-400 hover:text-white p-1"><ChevronUp size={14} /></button>
                <button onClick={() => moveEntry(selectedIdx, selectedIdx + 1)} className="text-gray-400 hover:text-white p-1"><ChevronDown size={14} /></button>
                <button onClick={() => moveEntry(selectedIdx, entries.length - 1)} className="text-gray-400 hover:text-white p-1"><ChevronsDown size={14} /></button>
              </div>
            )}
          </div>

          {entries.length === 0 && <p className="text-xs text-gray-500">등록된 항목이 없습니다.</p>}

          {entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="pb-2 pr-2 font-medium text-gray-400">층수</th>
                    <th className="pb-2 pr-2 font-medium text-gray-400">실명</th>
                    <th className="pb-2 pr-2 font-medium text-gray-400">용도</th>
                    <th className="pb-2 pr-2 font-medium text-gray-400 text-right">슬래브</th>
                    <th className="pb-2 pr-2 font-medium text-gray-400 text-right">고정하중</th>
                    <th className="pb-2 pr-2 font-medium text-gray-400 text-right">활하중</th>
                    <th className="pb-2 pr-2 font-medium text-gray-400 text-right">D+L</th>
                    <th className="pb-2 font-medium text-gray-400 text-right">1.2D+1.6L</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const ft = e.finishes.reduce((s, r) => { const v = parseFloat(r.load); return s + (isNaN(v) ? 0 : v); }, 0);
                    const sl = parseFloat(e.slabLoad) || 0;
                    const d = ft + sl;
                    const l = parseFloat(e.liveLoad) || 0;
                    const isSelected = selectedIdx === idx;
                    return (
                      <tr key={`${idx}-${e.id}`} onClick={() => selectEntry(idx)}
                        className={`border-b border-gray-700/50 cursor-pointer transition-colors ${isSelected ? "bg-blue-900/30" : "hover:bg-gray-700/30"}`}>
                        <td className="py-1.5 pr-2 text-white">{e.floor}</td>
                        <td className="py-1.5 pr-2 text-white">{e.roomName}</td>
                        <td className="py-1.5 pr-2 text-gray-300 truncate max-w-[100px]">{e.usageDetail}</td>
                        <td className="py-1.5 pr-2 text-gray-300 text-right">{e.slabThickness || "-"}</td>
                        <td className="py-1.5 pr-2 text-gray-300 text-right">{d.toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-gray-300 text-right">{l.toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-gray-300 text-right">{(d + l).toFixed(2)}</td>
                        <td className="py-1.5 text-blue-300 text-right font-medium">{(1.2 * d + 1.6 * l).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
