"use client";

import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export default function FormField({ label, children, className = "" }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
