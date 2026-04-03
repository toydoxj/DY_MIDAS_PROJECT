"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL, ProjectData, StoryRow } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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

function parseComment(comment: string) {
  try {
    const obj = JSON.parse(comment);
    return { projectCode: obj["PROJECT_CODE"] ?? "", floorArea: obj["FLOOR_AREA"] ?? "", actualHeight: obj["ACTUAL_HEIGHT"] ?? "" };
  } catch {
    return { projectCode: comment, floorArea: "", actualHeight: "" };
  }
}

function buildComment(projectCode: string, floorArea: string, actualHeight: string): string {
  return JSON.stringify({ PROJECT_CODE: projectCode, FLOOR_AREA: floorArea, ACTUAL_HEIGHT: actualHeight });
}

export default function ProjectSection({ onAddressChange, storyRows }: { onAddressChange: (addr: string) => void; storyRows: StoryRow[] }) {
  const [data, setData] = useState<ProjectData>({ PROJECT: "", CLIENT: "", ADDRESS: "", COMMENT: "" });
  const [projectCode, setProjectCode] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [actualHeight, setActualHeight] = useState("");
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
      const parsed = parseComment(newData.COMMENT);
      setProjectCode(parsed.projectCode);
      setFloorArea(parsed.floorArea);
      setActualHeight(parsed.actualHeight);
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
      const saveData = { ...data, COMMENT: buildComment(projectCode, floorArea, actualHeight) };
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
        <Input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
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
          <Input value={floorArea} onChange={(e) => setFloorArea(e.target.value)} placeholder="수동 입력" />
        </FormField>
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
          <Input value={actualHeight} onChange={(e) => setActualHeight(e.target.value)} placeholder="수동 입력" />
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
