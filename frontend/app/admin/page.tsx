"use client";

import { useState, useEffect, useCallback } from "react";
import { AUTH_URL } from "@/lib/types";
import { authFetch, getUser } from "@/lib/auth";
import { UserPlus, Trash2, Shield, User, Check, X } from "lucide-react";

interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
  status: string;
  midas_url: string;
  work_dir: string;
  has_midas_key: boolean;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentUser = getUser();

  // 새 사용자 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${AUTH_URL}/api/auth/users`);
      if (res.status === 403) { setError("관리자 권한이 필요합니다"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(`${AUTH_URL}/api/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword, name: newName }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `등록 실패 (${res.status})`);
      }
      setNewUsername(""); setNewPassword(""); setNewName(""); setShowForm(false);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await authFetch(`${AUTH_URL}/api/auth/users/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("승인 실패");
      fetchUsers();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "승인 실패"); }
  };

  const handleReject = async (id: number) => {
    try {
      const res = await authFetch(`${AUTH_URL}/api/auth/users/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("거절 실패");
      fetchUsers();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "거절 실패"); }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`"${username}" 사용자를 삭제하시겠습니까?`)) return;
    try {
      const res = await authFetch(`${AUTH_URL}/api/auth/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `삭제 실패`);
      }
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          관리자 권한이 필요합니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
          <p className="text-gray-500 mt-1">등록된 사용자 {users.length}명</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[#669900] text-white rounded-lg hover:bg-[#5a8700] transition"
        >
          <UserPlus size={14} />
          사용자 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* 사용자 추가 폼 */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">새 사용자 등록</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">이름</label>
              <input
                type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
                placeholder="홍길동" required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">아이디</label>
              <input
                type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
                placeholder="user01" required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">초기 비밀번호</label>
              <input
                type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
                placeholder="1234" required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-[#669900] text-white rounded-lg hover:bg-[#5a8700] disabled:opacity-50 transition">
              {saving ? "등록 중..." : "등록"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              취소
            </button>
          </div>
        </form>
      )}

      {/* 사용자 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사용자</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">아이디</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">역할</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">상태</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">MIDAS 연결</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name || "-"}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                    u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {u.role === "admin" ? <Shield size={10} /> : <User size={10} />}
                    {u.role === "admin" ? "관리자" : "사용자"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    u.status === "active" ? "bg-green-100 text-green-700" :
                    u.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {u.status === "active" ? "활성" : u.status === "pending" ? "승인 대기" : "거절"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.has_midas_key ? "text-green-600" : "text-gray-400"}`}>
                    {u.has_midas_key ? "연결됨" : "미설정"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {u.status === "pending" && (
                      <>
                        <button onClick={() => handleApprove(u.id)} className="text-green-500 hover:text-green-700 transition p-1" title="승인">
                          <Check size={14} />
                        </button>
                        <button onClick={() => handleReject(u.id)} className="text-red-400 hover:text-red-600 transition p-1" title="거절">
                          <X size={14} />
                        </button>
                      </>
                    )}
                    {u.id !== currentUser?.id && (
                      <button onClick={() => handleDelete(u.id, u.username)} className="text-gray-400 hover:text-red-500 transition p-1" title="삭제">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
