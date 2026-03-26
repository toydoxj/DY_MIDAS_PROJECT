"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BACKEND_URL } from "@/lib/types";
import { flattenResponse } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import Select from "@/components/ui/Select";
import { ErrorText } from "@/components/ui/StatusMessage";

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
      setResult(flattenResponse(data));
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
      <PageHeader title="RC보 검토" subtitle="Beam Design Forces" backHref="/member-check" />

      <SectionCard>
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
          <Select
            value={selectedSectId ?? ""}
            onChange={(e) => handleSectionChange(Number(e.target.value))}
            className="py-2"
          >
            <option value="" disabled>Section을 선택하세요</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.name} ({s.element_count}개 부재)
              </option>
            ))}
          </Select>
        ) : (
          !loadingSections && <p className="text-sm text-gray-500">Section 데이터가 없습니다.</p>
        )}

        {selectedSection && (
          <p className="text-xs text-gray-500">
            선택: <span className="text-gray-300">{selectedSection.name}</span> · 부재 {selectedSection.element_count}개 · Element Keys: [{selectedSection.element_keys.slice(0, 10).join(", ")}{selectedSection.element_keys.length > 10 ? ", ..." : ""}]
          </p>
        )}
      </SectionCard>

      {error && <ErrorText message={error} />}

      {loadingResult && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 flex items-center justify-center gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">설계결과 조회 중...</span>
        </div>
      )}

      {result && result.length > 0 && (
        <SectionCard title={`설계결과 — ${selectedSection?.name} (${result.length}개 행)`}>
          <DataTable columns={columns} rows={result} />
        </SectionCard>
      )}

      {result && result.length === 0 && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-8 text-center text-gray-500 text-sm">
          조회된 설계결과가 없습니다.
        </div>
      )}
    </div>
  );
}
