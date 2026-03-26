"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle } from "lucide-react";
import { BACKEND_URL, ProjectData, StoryRow } from "@/lib/types";

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
    } finally { setSaving(false); }
  };

  const fields: { key: keyof ProjectData; label: string }[] = [
    { key: "PROJECT", label: "프로젝트명" },
    { key: "CLIENT", label: "발주처" },
    { key: "ADDRESS", label: "주소" },
  ];

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">프로젝트 정보</h2>
        <button type="button" onClick={fetch_} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> 새로고침
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Project CODE</label>
        <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <input value={data[key]} onChange={(e) => { const val = e.target.value; setData((p) => ({ ...p, [key]: val })); if (key === "ADDRESS") onAddressChange(val); }}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">연면적 (m²)</label>
          <input value={floorArea} onChange={(e) => setFloorArea(e.target.value)} placeholder="수동 입력" className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><label className="block text-xs font-medium text-gray-400 mb-1">지상층수</label><div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">{aboveFloors > 0 ? `${aboveFloors}F` : "-"}</div></div>
        <div><label className="block text-xs font-medium text-gray-400 mb-1">지하층수</label><div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">{belowFloors > 0 ? `B${belowFloors}` : "-"}</div></div>
        <div><label className="block text-xs font-medium text-gray-400 mb-1">해석높이 (m)</label><div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">{analysisHeight > 0 ? analysisHeight.toFixed(3) : "-"}</div></div>
        <div><label className="block text-xs font-medium text-gray-400 mb-1">실제높이 (m)</label><input value={actualHeight} onChange={(e) => setActualHeight(e.target.value)} placeholder="수동 입력" className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />업데이트됨</span>}
        <button type="submit" disabled={saving} className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
        </button>
      </div>
    </form>
  );
}
