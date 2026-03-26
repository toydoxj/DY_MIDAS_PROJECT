"use client";

import { CheckCircle, XCircle } from "lucide-react";

interface SavedBadgeProps {
  label?: string;
}

export function SavedBadge({ label = "저장됨" }: SavedBadgeProps) {
  return (
    <span className="text-xs text-green-400 flex items-center gap-1">
      <CheckCircle size={13} />
      {label}
    </span>
  );
}

interface ErrorTextProps {
  message: string;
}

export function ErrorText({ message }: ErrorTextProps) {
  return <p className="text-xs text-red-400">{message}</p>;
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
        isSuccess ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"
      }`}
    >
      {isSuccess ? (
        <CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
      )}
      <p className={`text-sm ${isSuccess ? "text-green-300" : "text-red-300"}`}>{message}</p>
    </div>
  );
}
