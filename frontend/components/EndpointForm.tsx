"use client";

import { useState, useRef } from "react";
import DataTable from "./DataTable";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type Method = "GET" | "POST" | "PUT" | "DELETE";

function flattenResponse(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // { Assign: { "1": {...}, ... } } 형태 처리
    const firstKey = Object.keys(obj)[0];
    if (firstKey && typeof obj[firstKey] === "object" && !Array.isArray(obj[firstKey])) {
      const inner = obj[firstKey] as Record<string, unknown>;
      const values = Object.values(inner);
      if (values.length > 0 && typeof values[0] === "object" && values[0] !== null) {
        return Object.entries(inner).map(([k, v]) => ({ KEY: k, ...(v as Record<string, unknown>) }));
      }
    }
    return [obj];
  }
  return [];
}

export default function EndpointForm() {
  const [path, setPath] = useState("STOR");
  const [method, setMethod] = useState<Method>("GET");
  const [body, setBody] = useState("{}");
  const [bodyError, setBodyError] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResponse(null);

    let parsedBody: unknown = {};
    if (method !== "GET" && method !== "DELETE") {
      try {
        parsedBody = JSON.parse(body);
        setBodyError("");
      } catch {
        setBodyError("유효하지 않은 JSON 형식입니다");
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);

    setLoading(true);
    try {
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      };
      if (method !== "GET" && method !== "DELETE") {
        opts.body = JSON.stringify(parsedBody);
      }
      const res = await fetch(`${BACKEND_URL}/api/midas/${path}`, opts);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.detail ?? `HTTP ${res.status}`);
      } else {
        setResponse(json);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("요청이 취소되었습니다 (30초 타임아웃).");
      } else {
        setError(String(err));
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const rows = response ? flattenResponse(response) : [];
  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
      : [];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-4">
        {/* Method + Path */}
        <div className="flex gap-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(["GET", "POST", "PUT", "DELETE"] as Method[]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="flex flex-1 items-center rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white">
            <span className="text-gray-400 mr-1">/db/</span>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="STOR"
              className="flex-1 bg-transparent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "요청 중..." : "전송"}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm font-medium text-red-400 hover:bg-gray-600 transition-colors"
            >
              취소
            </button>
          )}
        </div>

        {/* Body (POST/PUT only) */}
        {(method === "POST" || method === "PUT") && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Request Body (JSON)
            </label>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setBodyError("");
              }}
              rows={6}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            {bodyError && <p className="text-red-400 text-xs mt-1">{bodyError}</p>}
          </div>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Response */}
      {response !== null && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">응답</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("table")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
              >
                테이블
              </button>
              <button
                onClick={() => setViewMode("json")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${viewMode === "json" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
              >
                JSON
              </button>
            </div>
          </div>

          {viewMode === "json" ? (
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 font-mono max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : rows.length > 0 ? (
            <DataTable columns={columns} rows={rows} />
          ) : (
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 font-mono max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
