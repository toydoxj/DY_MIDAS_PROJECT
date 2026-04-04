"use client";

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
    <div className="grid grid-cols-3 gap-3">
      <FormField label={`fck (MPa)`}>
        <Input type="number" value={fck} onChange={(e) => onChange({ fck: Number(e.target.value) || DEFAULT_FCK })} />
      </FormField>
      <FormField label={`fy (MPa)`}>
        <Input type="number" value={fy} onChange={(e) => onChange({ fy: Number(e.target.value) || DEFAULT_FY })} />
      </FormField>
      <FormField label={`fyt (MPa)`}>
        <Input type="number" value={fyt} onChange={(e) => onChange({ fyt: Number(e.target.value) || DEFAULT_FYT })} />
      </FormField>
    </div>
  );
}
