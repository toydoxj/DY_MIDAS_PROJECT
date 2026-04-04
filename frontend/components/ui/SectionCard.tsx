"use client";

import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "div" | "form";
  onSubmit?: (e: React.FormEvent) => void;
}

export default function SectionCard({
  title,
  action,
  children,
  className = "",
  as: Tag = "div",
  onSubmit,
}: SectionCardProps) {
  return (
    <Tag
      className={`rounded-xl bg-white border border-gray-200 shadow-sm p-5 space-y-3 ${className}`}
      {...(Tag === "form" ? { onSubmit } : {})}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-1">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {action && <div className="flex items-center gap-3">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
