"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/types";

type Status = "checking" | "connected" | "disconnected" | "unconfigured";

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>("checking");

  const check = async () => {
    setStatus("checking");
    try {
      const res = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" });
      if (!res.ok) { setStatus("disconnected"); return; }
      const data = await res.json();
      if (!data.configured) { setStatus("unconfigured"); return; }
      // 실제 연결 테스트
      const test = await fetch(`${BACKEND_URL}/api/test-connection`, { cache: "no-store" });
      const testData = await test.json();
      setStatus(testData.connected ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { check(); }, []);

  const config: Record<Status, { dot: string; label: string }> = {
    checking:     { dot: "bg-yellow-400 animate-pulse", label: "확인 중..." },
    connected:    { dot: "bg-green-400",                label: "연결됨" },
    disconnected: { dot: "bg-red-500",                  label: "연결 안됨" },
    unconfigured: { dot: "bg-gray-500",                 label: "설정 필요" },
  };

  const { dot, label } = config[status];

  return (
    <button
      onClick={check}
      title="클릭하여 재확인"
      className="flex items-center gap-2 w-full rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
    >
      <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </button>
  );
}
