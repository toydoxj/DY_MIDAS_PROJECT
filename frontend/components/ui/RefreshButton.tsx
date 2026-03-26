"use client";

import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function RefreshButton({ onClick, loading = false, disabled = false }: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
    >
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
      새로고침
    </button>
  );
}
