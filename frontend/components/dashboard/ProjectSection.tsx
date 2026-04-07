"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL, ProjectData, StoryRow } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import FormField from "@/components/ui/FormField";
import RefreshButton from "@/components/ui/RefreshButton";
import { SavedBadge } from "@/components/ui/StatusMessage";

function calcFromStory(rows: StoryRow[]) {
  let aboveFloors = 0;
  let belowFloors = 0;
  let maxLevel = 0;
  for (const r of rows) {
    const name = r.STORY_NAME.trim();
    const aboveMatch = name.match(/^(\d+)F$/i);
    if (aboveMatch) aboveFloors = Math.max(aboveFloors, parseInt(aboveMatch[1]));
    const belowMatch = name.match(/^B(\d+)F?$/i);
    if (belowMatch) belowFloors = Math.max(belowFloors, parseInt(belowMatch[1]));
    if (r.STORY_LEVEL > maxLevel) maxLevel = r.STORY_LEVEL;
  }
  return { aboveFloors, belowFloors, analysisHeight: maxLevel };
}

const IMPORTANCE_OPTIONS = ["특", "(1)", "(2)", "(3)"] as const;

const STRUCT_TYPE_OPTIONS = [
  "철근콘크리트 전단벽구조, 기타골조",
  "철근콘크리트 모멘트골조",
  "철골모멘트 골조",
  "철골 편심가새골조 및 좌굴방지가새골조",
] as const;

const SFRS_GROUPS = [
  { cat: "1. 내력벽시스템", items: [
    { id: "1-a", label: "1-a. 철근콘크리트 특수전단벽 (R=5, Ω₀=2.5, Cd=5)" },
    { id: "1-b", label: "1-b. 철근콘크리트 보통전단벽 (R=4, Ω₀=2.5, Cd=4)" },
    { id: "1-c", label: "1-c. 철근보강 조적 전단벽 (R=2.5, Ω₀=2.5, Cd=1.5)" },
    { id: "1-d", label: "1-d. 무보강 조적 전단벽 (R=1.5, Ω₀=2.5, Cd=1.5)" },
    { id: "1-e", label: "1-e. 경골목구조 전단벽 (R=6, Ω₀=3, Cd=4)" },
    { id: "1-f", label: "1-f. 경량철골조 전단벽 (R=6, Ω₀=3, Cd=4)" },
  ]},
  { cat: "2. 건물골조시스템", items: [
    { id: "2-a", label: "2-a. 철골 편심가새골조 - 모멘트 저항 접합 (R=8, Ω₀=2, Cd=4)" },
    { id: "2-b", label: "2-b. 철골 편심가새골조 - 비모멘트 저항접합 (R=7, Ω₀=2, Cd=4)" },
    { id: "2-c", label: "2-c. 철골 특수중심가새골조 (R=6, Ω₀=2, Cd=5)" },
    { id: "2-d", label: "2-d. 철골 보통중심가새골조 (R=3.25, Ω₀=2, Cd=3.25)" },
    { id: "2-e", label: "2-e. 합성 편심가새골조 (R=8, Ω₀=2, Cd=4)" },
    { id: "2-f", label: "2-f. 합성 특수중심가새골조 (R=5, Ω₀=2, Cd=4.5)" },
    { id: "2-g", label: "2-g. 합성 보통중심가새골조 (R=3, Ω₀=2, Cd=3)" },
    { id: "2-h", label: "2-h. 합성 강판전단벽 (R=6.5, Ω₀=2.5, Cd=5.5)" },
    { id: "2-i", label: "2-i. 합성 특수전단벽 (R=6, Ω₀=2.5, Cd=5)" },
    { id: "2-j", label: "2-j. 합성 보통전단벽 (R=5, Ω₀=2.5, Cd=4.5)" },
    { id: "2-k", label: "2-k. 철골 특수강판전단벽 (R=7, Ω₀=2, Cd=6)" },
    { id: "2-l", label: "2-l. 철골 좌굴방지가새골조 - 모멘트 저항 접합 (R=8, Ω₀=2.5, Cd=5)" },
    { id: "2-m", label: "2-m. 철골 좌굴방지가새골조 - 비모멘트 저항 접합 (R=7, Ω₀=2, Cd=5.5)" },
    { id: "2-n", label: "2-n. 철근콘크리트 특수전단벽 (R=6, Ω₀=2.5, Cd=5)" },
    { id: "2-o", label: "2-o. 철근콘크리트 보통전단벽 (R=5, Ω₀=2.5, Cd=4.5)" },
    { id: "2-p", label: "2-p. 철근보강 조적 전단벽 (R=3, Ω₀=2.5, Cd=2)" },
    { id: "2-q", label: "2-q. 무보강 조적 전단벽 (R=1.5, Ω₀=2.5, Cd=1.5)" },
    { id: "2-r", label: "2-r. 경골목구조 전단벽 (R=6.5, Ω₀=2.5, Cd=4.5)" },
    { id: "2-s", label: "2-s. 경량철골조 전단벽 (R=6.5, Ω₀=2.5, Cd=4.5)" },
  ]},
  { cat: "3. 모멘트-저항골조 시스템", items: [
    { id: "3-a", label: "3-a. 철골 특수모멘트골조 (R=8, Ω₀=3, Cd=5.5)" },
    { id: "3-b", label: "3-b. 철골 중간모멘트골조 (R=4.5, Ω₀=3, Cd=4)" },
    { id: "3-c", label: "3-c. 철골 보통모멘트골조 (R=3.5, Ω₀=3, Cd=3)" },
    { id: "3-d", label: "3-d. 합성 특수모멘트골조 (R=8, Ω₀=3, Cd=5.5)" },
    { id: "3-e", label: "3-e. 합성 중간모멘트골조 (R=5, Ω₀=3, Cd=4.5)" },
    { id: "3-f", label: "3-f. 합성 보통모멘트골조 (R=3, Ω₀=3, Cd=2.5)" },
    { id: "3-g", label: "3-g. 합성 반강접모멘트골조 (R=6, Ω₀=3, Cd=5.5)" },
    { id: "3-h", label: "3-h. 철근콘크리트 특수모멘트골조 (R=8, Ω₀=3, Cd=5.5)" },
    { id: "3-i", label: "3-i. 철근콘크리트 중간모멘트골조 (R=5, Ω₀=3, Cd=4.5)" },
    { id: "3-j", label: "3-j. 철근콘크리트 보통모멘트골조 (R=3, Ω₀=3, Cd=2.5)" },
  ]},
  { cat: "4. 이중골조 (특수모멘트골조)", items: [
    { id: "4-a", label: "4-a. 철골 편심가새골조 (R=8, Ω₀=2.5, Cd=4)" },
    { id: "4-b", label: "4-b. 철골 특수중심가새골조 (R=7, Ω₀=2.5, Cd=5.5)" },
    { id: "4-c", label: "4-c. 합성 편심가새골조 (R=8, Ω₀=2.5, Cd=4)" },
    { id: "4-d", label: "4-d. 합성 특수중심가새골조 (R=6, Ω₀=2.5, Cd=5)" },
    { id: "4-e", label: "4-e. 합성 강판전단벽 (R=7.5, Ω₀=2.5, Cd=6)" },
    { id: "4-f", label: "4-f. 합성 특수전단벽 (R=7, Ω₀=2.5, Cd=6)" },
    { id: "4-g", label: "4-g. 합성 보통전단벽 (R=6, Ω₀=2.5, Cd=5)" },
    { id: "4-h", label: "4-h. 철골 좌굴방지가새골조 (R=8, Ω₀=2.5, Cd=5)" },
    { id: "4-i", label: "4-i. 철골 특수강판전단벽 (R=8, Ω₀=2.5, Cd=6.5)" },
    { id: "4-j", label: "4-j. 철근콘크리트 특수전단벽 (R=7, Ω₀=2.5, Cd=5.5)" },
    { id: "4-k", label: "4-k. 철근콘크리트 보통전단벽 (R=6, Ω₀=2.5, Cd=5)" },
  ]},
  { cat: "5. 이중골조 (중간모멘트골조)", items: [
    { id: "5-a", label: "5-a. 철골 특수중심가새골조 (R=6, Ω₀=2.5, Cd=5)" },
    { id: "5-b", label: "5-b. 철근콘크리트 특수전단벽 (R=6.5, Ω₀=2.5, Cd=5)" },
    { id: "5-c", label: "5-c. 철근콘크리트 보통전단벽 (R=5.5, Ω₀=2.5, Cd=4.5)" },
    { id: "5-d", label: "5-d. 합성 특수중심가새골조 (R=5.5, Ω₀=2.5, Cd=4.5)" },
    { id: "5-e", label: "5-e. 합성 보통중심가새골조 (R=3.5, Ω₀=2.5, Cd=3)" },
    { id: "5-f", label: "5-f. 합성 보통전단벽 (R=5, Ω₀=3, Cd=4.5)" },
    { id: "5-g", label: "5-g. 철근보강 조적 전단벽 (R=3, Ω₀=3, Cd=2.5)" },
  ]},
  { cat: "6. 역추형 시스템", items: [
    { id: "6-a", label: "6-a. 캔틸레버 기둥 시스템 (R=2.5, Ω₀=2, Cd=2.5)" },
    { id: "6-b", label: "6-b. 철골 특수모멘트골조 (R=2.5, Ω₀=2, Cd=2.5)" },
    { id: "6-c", label: "6-c. 철골 보통모멘트골조 (R=1.25, Ω₀=2, Cd=2.5)" },
    { id: "6-d", label: "6-d. 철근콘크리트 특수모멘트골조 (R=2.5, Ω₀=2, Cd=1.25)" },
  ]},
  { cat: "7~10. 기타 시스템", items: [
    { id: "7", label: "7. RC 보통 전단벽-골조 상호작용 시스템 (R=4.5, Ω₀=2.5, Cd=4)" },
    { id: "8", label: "8. 강구조기준 일반규정만을 만족하는 철골구조시스템 (R=3, Ω₀=3, Cd=3)" },
    { id: "9", label: "9. RC구조기준 일반규정만을 만족하는 RC구조 시스템 (R=3, Ω₀=3, Cd=3)" },
    { id: "10", label: "10. 지하외벽으로 둘러싸인 지하구조시스템 (R=3, Ω₀=3, Cd=2.5)" },
  ]},
] as const;

interface CommentData {
  projectCode: string; floorArea: string; actualHeight: string;
  importance: string; shearWaveVelocity: string; bedrockDepth: string;
  structTypeX: string; structTypeY: string;
  sfrsX: string; sfrsY: string;
  legacyComment: string;
}

function parseComment(comment: string): CommentData {
  try {
    const obj = JSON.parse(comment);
    // JSON 파싱 성공 = 이미 구조화된 데이터
    return {
      projectCode: obj["PROJECT_CODE"] ?? "",
      floorArea: obj["FLOOR_AREA"] ?? "",
      actualHeight: obj["ACTUAL_HEIGHT"] ?? "",
      importance: obj["IMPORTANCE"] ?? "(1)",
      shearWaveVelocity: obj["SHEAR_WAVE_VELOCITY"] ?? "",
      bedrockDepth: obj["BEDROCK_DEPTH"] ?? "",
      structTypeX: obj["STRUCT_TYPE_X"] ?? "0",
      structTypeY: obj["STRUCT_TYPE_Y"] ?? "0",
      sfrsX: obj["SFRS_X"] ?? "1-a",
      sfrsY: obj["SFRS_Y"] ?? "1-a",
      legacyComment: obj["LEGACY_COMMENT"] ?? "",
    };
  } catch {
    // 레거시 자유 텍스트 → LEGACY_COMMENT에 보존
    return {
      projectCode: "", floorArea: "", actualHeight: "", importance: "(1)",
      shearWaveVelocity: "", bedrockDepth: "",
      structTypeX: "0", structTypeY: "0", sfrsX: "1-a", sfrsY: "1-a",
      legacyComment: comment,
    };
  }
}

function buildComment(d: CommentData): string {
  const obj: Record<string, string> = {
    PROJECT_CODE: d.projectCode, FLOOR_AREA: d.floorArea, ACTUAL_HEIGHT: d.actualHeight,
    IMPORTANCE: d.importance, SHEAR_WAVE_VELOCITY: d.shearWaveVelocity, BEDROCK_DEPTH: d.bedrockDepth,
    STRUCT_TYPE_X: d.structTypeX, STRUCT_TYPE_Y: d.structTypeY,
    SFRS_X: d.sfrsX, SFRS_Y: d.sfrsY,
  };
  if (d.legacyComment) obj.LEGACY_COMMENT = d.legacyComment;
  return JSON.stringify(obj);
}

export default function ProjectSection({ onAddressChange, storyRows }: { onAddressChange: (addr: string) => void; storyRows: StoryRow[] }) {
  const [data, setData] = useState<ProjectData>({ PROJECT: "", CLIENT: "", ADDRESS: "", COMMENT: "" });
  const [cd, setCd] = useState<CommentData>({
    projectCode: "", floorArea: "", actualHeight: "", importance: "(1)",
    shearWaveVelocity: "", bedrockDepth: "",
    structTypeX: "0", structTypeY: "0", sfrsX: "1-a", sfrsY: "1-a",
    legacyComment: "",
  });
  const updateCd = (patch: Partial<CommentData>) => setCd((p) => ({ ...p, ...patch }));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { aboveFloors, belowFloors, analysisHeight } = calcFromStory(storyRows);

  const fetch_ = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project`);
      if (!r.ok) throw new Error(`서버 오류: ${r.status}`);
      const d = await r.json();
      const newData = { PROJECT: d.PROJECT ?? "", CLIENT: d.CLIENT ?? "", ADDRESS: d.ADDRESS ?? "", COMMENT: d.COMMENT ?? "" };
      setData(newData);
      if (newData.ADDRESS) onAddressChange(newData.ADDRESS);
      setCd(parseComment(newData.COMMENT));
    } catch (err) {
      console.warn("프로젝트 정보 조회 실패:", err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const saveData = { ...data, COMMENT: buildComment(cd) };
      const res = await fetch(`${BACKEND_URL}/api/project`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saveData) });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      setSaved(true);
    } catch (err) {
      console.warn("프로젝트 정보 저장 실패:", err);
    } finally { setSaving(false); }
  };

  const fields: { key: keyof ProjectData; label: string }[] = [
    { key: "PROJECT", label: "프로젝트명" },
    { key: "CLIENT", label: "발주처" },
    { key: "ADDRESS", label: "주소" },
  ];

  const headerAction = <RefreshButton onClick={fetch_} loading={loading} />;

  return (
    <SectionCard as="form" title="프로젝트 정보" action={headerAction} onSubmit={handleSave}>
      <FormField label="Project CODE">
        <Input value={cd.projectCode} onChange={(e) => updateCd({ projectCode: e.target.value })} />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <FormField key={key} label={label}>
            <Input
              value={data[key]}
              onChange={(e) => {
                const val = e.target.value;
                setData((p) => ({ ...p, [key]: val }));
                if (key === "ADDRESS") onAddressChange(val);
              }}
            />
          </FormField>
        ))}
        <FormField label="연면적 (m²)">
          <Input value={cd.floorArea} onChange={(e) => updateCd({ floorArea: e.target.value })} placeholder="수동 입력" />
        </FormField>
        <FormField label="중요도">
          <Select value={cd.importance} onChange={(e) => updateCd({ importance: e.target.value })}>
            {IMPORTANCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="평균전단파속도 (m/s)">
          <Input type="number" value={cd.shearWaveVelocity} onChange={(e) => updateCd({ shearWaveVelocity: e.target.value })} placeholder="수동 입력" />
        </FormField>
        <FormField label="기반암깊이 (m)">
          <Input type="number" value={cd.bedrockDepth} onChange={(e) => updateCd({ bedrockDepth: e.target.value })} placeholder="수동 입력" />
        </FormField>
      </div>

      {/* 지진 설계 (X/Y 방향) */}
      <div className="border-t border-gray-700 pt-3 mt-1">
        <p className="text-xs text-gray-400 mb-2 font-medium">지진 설계 (X / Y 방향)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="구조물 형식 (X)">
            <Select value={cd.structTypeX} onChange={(e) => updateCd({ structTypeX: e.target.value })}>
              {STRUCT_TYPE_OPTIONS.map((opt, i) => (
                <option key={i} value={String(i)}>{opt}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="구조물 형식 (Y)">
            <Select value={cd.structTypeY} onChange={(e) => updateCd({ structTypeY: e.target.value })}>
              {STRUCT_TYPE_OPTIONS.map((opt, i) => (
                <option key={i} value={String(i)}>{opt}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="지진력저항시스템 (X)">
            <Select value={cd.sfrsX} onChange={(e) => updateCd({ sfrsX: e.target.value })}>
              {SFRS_GROUPS.map((g) => (
                <optgroup key={g.cat} label={g.cat}>
                  {g.items.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </FormField>
          <FormField label="지진력저항시스템 (Y)">
            <Select value={cd.sfrsY} onChange={(e) => updateCd({ sfrsY: e.target.value })}>
              {SFRS_GROUPS.map((g) => (
                <optgroup key={g.cat} label={g.cat}>
                  {g.items.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField label="지상층수">
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">
            {aboveFloors > 0 ? `${aboveFloors}F` : "-"}
          </div>
        </FormField>
        <FormField label="지하층수">
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">
            {belowFloors > 0 ? `B${belowFloors}` : "-"}
          </div>
        </FormField>
        <FormField label="해석높이 (m)">
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">
            {analysisHeight > 0 ? analysisHeight.toFixed(3) : "-"}
          </div>
        </FormField>
        <FormField label="실제높이 (m)">
          <Input value={cd.actualHeight} onChange={(e) => updateCd({ actualHeight: e.target.value })} placeholder="수동 입력" />
        </FormField>
      </div>
      <div className="flex items-center gap-3 pt-1">
        {saved && <SavedBadge label="업데이트됨" />}
        <Button type="submit" size="xs" loading={saving} className="ml-auto">
          {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
        </Button>
      </div>
    </SectionCard>
  );
}
