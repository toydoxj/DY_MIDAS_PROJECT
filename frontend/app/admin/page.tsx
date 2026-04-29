"use client";

import { useEffect, useState } from "react";
import { getToken, getUser } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/types";

interface UserSummary {
  user_id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  last_seen: string;
  total_logins: number;
}

interface AccessEvent {
  id: number;
  user_id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  sid: string | null;
  ip: string;
  user_agent: string;
  app_version: string;
  ts: string;
}

interface AccessLogResponse {
  users: UserSummary[];
  recent: AccessEvent[];
}

function fmtDate(iso: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [data, setData] = useState<AccessLogResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const me = getUser();

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      // raw fetch (authFetch 금지) — 401 응답에 자동 logout이 발동하면
      // 정상 세션도 강제로 끊어버려 로그인 화면으로 튕긴다.
      const res = await fetch(`${BACKEND_URL}/api/admin/access-log?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 401) {
        setError("세션 인증 실패 — task 백엔드 통신 문제일 수 있습니다. 새로고침 후 재시도하세요.");
        setData(null);
        return;
      }
      if (res.status === 403) {
        setError("관리자 권한이 필요합니다.");
        setData(null);
        return;
      }
      if (!res.ok) {
        setError(`조회 실패 (${res.status})`);
        setData(null);
        return;
      }
      const d: AccessLogResponse = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  if (me && me.role !== "admin") {
    return (
      <div className="text-sm text-red-400 p-6">
        관리자 권한이 필요합니다.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-200">사용자 로그인 현황</h1>
          <p className="text-xs text-gray-500 mt-1">
            본 앱(MIDAS Dashboard) 사용자 접속 기록 — sidecar의 자체 access log
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#669900] text-white hover:bg-[#5a8700] disabled:opacity-50 transition"
        >
          {loading ? "조회 중..." : "새로고침"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* 사용자별 요약 */}
      <section className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">사용자별 요약</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            마지막 접속 시각 기준 정렬. 누적 접속 = 본 앱에 로그인한 횟수(고유 세션)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-900/40 text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left px-3 py-2 font-medium">아이디</th>
                <th className="text-left px-3 py-2 font-medium">이름</th>
                <th className="text-left px-3 py-2 font-medium">이메일</th>
                <th className="text-left px-3 py-2 font-medium">권한</th>
                <th className="text-left px-3 py-2 font-medium">마지막 접속</th>
                <th className="text-right px-3 py-2 font-medium">누적 접속</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {(data?.users ?? []).map((u) => (
                <tr key={u.user_id} className="text-gray-300 hover:bg-gray-700/30">
                  <td className="px-3 py-2 font-mono">{u.username}</td>
                  <td className="px-3 py-2">{u.name || "-"}</td>
                  <td className="px-3 py-2 text-gray-400">{u.email || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                      u.role === "admin"
                        ? "bg-[#669900]/20 text-[#8cbf2d]"
                        : "bg-gray-700 text-gray-400"
                    }`}>
                      {u.role || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-400">{fmtDate(u.last_seen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.total_logins}</td>
                </tr>
              ))}
              {!loading && (data?.users ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    아직 기록된 접속이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 최근 접속 이력 */}
      <section className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300">최근 접속 이력</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            최대 200건. 동일 세션(JWT sid)은 1회만 기록.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-900/40 text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left px-3 py-2 font-medium">시각</th>
                <th className="text-left px-3 py-2 font-medium">아이디</th>
                <th className="text-left px-3 py-2 font-medium">이름</th>
                <th className="text-left px-3 py-2 font-medium">버전</th>
                <th className="text-left px-3 py-2 font-medium">IP</th>
                <th className="text-left px-3 py-2 font-medium">User-Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {(data?.recent ?? []).map((e) => (
                <tr key={e.id} className="text-gray-300 hover:bg-gray-700/30">
                  <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap">{fmtDate(e.ts)}</td>
                  <td className="px-3 py-2 font-mono">{e.username}</td>
                  <td className="px-3 py-2">{e.name || "-"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{e.app_version || "-"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{e.ip || "-"}</td>
                  <td className="px-3 py-2 text-gray-500 truncate max-w-md" title={e.user_agent}>
                    {e.user_agent || "-"}
                  </td>
                </tr>
              ))}
              {!loading && (data?.recent ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
