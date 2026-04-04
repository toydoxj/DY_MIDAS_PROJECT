"use client";

import SectionCard from "@/components/ui/SectionCard";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import { DEFAULT_FCK, DEFAULT_FY, DEFAULT_FYT } from "../_lib/constants";

interface Props {
  fck: number;
  fy: number;
  fyt: number;
  onChange: (v: { fck?: number; fy?: number; fyt?: number }) => void;
}

export default function MaterialInput({ fck, fy, fyt, onChange }: Props) {
  return (
    <SectionCard title="재료 강도">
      <div className="grid grid-cols-3 gap-3">
        <FormField label={`fck (MPa) [기본 ${DEFAULT_FCK}]`}>
          <Input type="number" value={fck} onChange={(e) => onChange({ fck: Number(e.target.value) || DEFAULT_FCK })} />
        </FormField>
        <FormField label={`fy (MPa) [기본 ${DEFAULT_FY}]`}>
          <Input type="number" value={fy} onChange={(e) => onChange({ fy: Number(e.target.value) || DEFAULT_FY })} />
        </FormField>
        <FormField label={`fyt (MPa) [기본 ${DEFAULT_FYT}]`}>
          <Input type="number" value={fyt} onChange={(e) => onChange({ fyt: Number(e.target.value) || DEFAULT_FYT })} />
        </FormField>
      </div>
    </SectionCard>
  );
}
