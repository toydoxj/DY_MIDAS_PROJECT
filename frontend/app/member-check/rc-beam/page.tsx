"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BACKEND_URL } from "@/lib/types";

interface SectionInfo {
  id: number;
  name: string;
  type: string;
  element_count: number;
  element_keys: number[];
}

export default function RcBeamCheckPage() {
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [selectedSectId, setSelectedSectId] = useState<number | null>(null);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState("");

  // Section 목록 조회
  const fetchSections = async () => {
    setLoadingSections(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/member/sections`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SectionInfo[] = await res.json();
      setSections(data);
      setSelectedSectId(null);
      setResult(null);
    } catch (e) {
      setError(`Section 조회 실패: ${e}`);
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => { fetchSections(); }, []);

  // 선택된 Section의 설계결과 조회
  const fetchDesignResult = async (keys: number[]) => {
    setLoadingResult(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/midas/post/TABLE`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Argument: {
            TABLE_TYPE: "BEAMDESIGNFORCES",
            UNIT: { FORCE: "KN", DIST: "M" },
            STYLES: { FORMAT: "Fixed", PLACE: 3 },
            NODE_ELEMS: { KEYS: keys },
            PARTS: ["PartI", "PartJ"],
            COMPONENTS: ["Memb", "Part", "LComName", "Type", "Fz", "Mx", "My(-)", "My(+)"],
          },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail ?? errData?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      // 응답 평탄화
      const rows = flattenResponse(data);
      setResult(rows);
    } catch (e) {
      setError(`설계결과 조회 실패: ${e}`);
    } finally {
      setLoadingResult(false);
    }
  };

  const handleSectionChange = (sectId: number) => {
    setSelectedSectId(sectId);
    const sect = sections.find((s) => s.id === sectId);
    if (sect && sect.element_keys.length > 0) {
      fetchDesignResult(sect.element_keys);
    } else {
      setResult(null);
      setError("선택한 Section에 속한 부재가 없습니다.");
    }
  };

  const selectedSection = sections.find((s) => s.id === selectedSectId);
  const columns = result && result.length > 0
    ? Object.keys(result[0]).map((k) => ({ key: k, label: k }))
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link href="/member-check" className="rounded-lg bg-gray-800 p-2 hover:bg-gray-700 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">RC보 검토</h1>
          <p className="text-gray-400 mt-0.5">Beam Design Forces</p>
        </div>
      </div>

      {/* Section 선택 */}
      <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-300">Section 선택</label>
          <button
            onClick={fetchSections}
            disabled={loadingSections}
            className="rounded-lg bg-gray-700 p-1.5 hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Section 새로고침"
          >
            <RefreshCw size={14} className={loadingSections ? "animate-spin" : ""} />
          </button>
        </div>

        {sections.length > 0 ? (
          <select
            value={selectedSectId ?? ""}
            onChange={(e) => handleSectionChange(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Section을 선택하세요</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.name} ({s.element_count}개 부재)
              </option>
            ))}
          </select>
        ) : (
          !loadingSections && <p className="text-sm text-gray-500">Section 데이터가 없습니다.</p>
        )}

        {selectedSection && (
          <p className="text-xs text-gray-500">
            선택: <span className="text-gray-300">{selectedSection.name}</span> · 부재 {selectedSection.element_count}개 · Element Keys: [{selectedSection.element_keys.slice(0, 10).join(", ")}{selectedSection.element_keys.length > 10 ? ", ..." : ""}]
          </p>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loadingResult && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 flex items-center justify-center gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">설계결과 조회 중...</span>
        </div>
      )}

      {/* 결과 테이블 */}
      {result && result.length > 0 && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            설계결과 — {selectedSection?.name} ({result.length}개 행)
          </h2>
          <DataTable columns={columns} rows={result} />
        </div>
      )}

      {result && result.length === 0 && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 text-center text-gray-500 text-sm">
          조회된 설계결과가 없습니다.
        </div>
      )}
    </div>
  );
}

// 응답 평탄화 유틸리티 (HEAD+DATA 형식 지원)
function flattenResponse(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];

  const obj = data as Record<string, unknown>;

  // HEAD + DATA 형식 감지 (직접 또는 중첩)
  const target = obj.HEAD && obj.DATA ? obj : Object.values(obj).find(
    (v) => v && typeof v === "object" && !Array.isArray(v) && (v as Record<string, unknown>).HEAD && (v as Record<string, unknown>).DATA
  ) as Record<string, unknown> | undefined;

  if (target) {
    const head = target.HEAD as string[];
    const rows = target.DATA as unknown[][];
    return rows.map((row) => {
      const record: Record<string, unknown> = {};
      head.forEach((col, i) => { record[col] = row[i] ?? ""; });
      return record;
    });
  }

  // 기존 중첩 dict 처리
  const firstKey = Object.keys(obj)[0];
  if (firstKey && typeof obj[firstKey] === "object" && !Array.isArray(obj[firstKey])) {
    const inner = obj[firstKey] as Record<string, unknown>;
    const values = Object.values(inner);
    if (values.length > 0 && typeof values[0] === "object" && values[0] !== null) {
      return Object.entries(inner).map(([k, v]) => ({ KEY: k, ...(v as Record<string, unknown>) }));
    }
  }
  return [obj];
}
