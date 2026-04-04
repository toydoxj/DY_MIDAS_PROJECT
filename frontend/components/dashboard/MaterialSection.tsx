"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/types";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import FormField from "@/components/ui/FormField";
import { SavedBadge } from "@/components/ui/StatusMessage";

const FCK_OPTIONS = [21, 24, 27, 30, 35, 40, 50, 60] as const;
const FY_OPTIONS = [300, 400, 500, 550, 600] as const;

export default function MaterialSection() {
  const [fck, setFck] = useState(27);
  const [fy, setFy] = useState(400);
  const [fyt, setFyt] = useState(400);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/project`)
      .then((r) => r.json())
      .then((d) => {
        try {
          const c = JSON.parse(d.COMMENT ?? "{}");
          if (c.FCK) setFck(Number(c.FCK));
          if (c.FY) setFy(Number(c.FY));
          if (c.FYT) setFyt(Number(c.FYT));
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      // 기존 COMMENT 읽어서 병합
      const res = await fetch(`${BACKEND_URL}/api/project`);
      if (!res.ok) throw new Error("프로젝트 조회 실패");
      const proj = await res.json();
      let comment: Record<string, unknown> = {};
      try { comment = JSON.parse(proj.COMMENT ?? "{}"); } catch { /* ignore */ }
      comment.FCK = String(fck);
      comment.FY = String(fy);
      comment.FYT = String(fyt);

      const saveRes = await fetch(`${BACKEND_URL}/api/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proj, COMMENT: JSON.stringify(comment) }),
      });
      if (!saveRes.ok) throw new Error("저장 실패");
      setSaved(true);
    } catch (err) {
      console.warn("재료 강도 저장 실패:", err);
    } finally { setSaving(false); }
  };

  return (
    <SectionCard as="form" title="재료 강도" onSubmit={handleSave}>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="fck (MPa)">
          <Select value={fck} onChange={(e) => setFck(Number(e.target.value))}>
            {FCK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="fy (MPa)">
          <Select value={fy} onChange={(e) => setFy(Number(e.target.value))}>
            {FY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="fyt (MPa)">
          <Select value={fyt} onChange={(e) => setFyt(Number(e.target.value))}>
            {FY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="flex items-center gap-3 pt-1">
        {saved && <SavedBadge label="저장됨" />}
        <Button type="submit" size="xs" loading={saving} className="ml-auto">
          {saving ? "저장 중..." : "MIDAS에 업데이트"}
        </Button>
      </div>
    </SectionCard>
  );
}
