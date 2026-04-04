"use client";

import { CheckCircle, XCircle } from "lucide-react";

interface SavedBadgeProps {
  label?: string;
}

export function SavedBadge({ label = "저장됨" }: SavedBadgeProps) {
  return (
    <span className="text-xs text-emerald-600 flex items-center gap-1">
      <CheckCircle size={13} />
      {label}
    </span>
  );
}

interface ErrorTextProps {
  message: string;
}

export function ErrorText({ message }: ErrorTextProps) {
  return <p className="text-xs text-red-600">{message}</p>;
}

interface AlertBannerProps {
  type: "success" | "error";
  message: string;
}

export function AlertBanner({ type, message }: AlertBannerProps) {
  const isSuccess = type === "success";
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
        isSuccess ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
      }`}
    >
      {isSuccess ? (
        <CheckCircle size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
      )}
      <p className={`text-sm ${isSuccess ? "text-emerald-700" : "text-red-700"}`}>{message}</p>
    </div>
  );
}
