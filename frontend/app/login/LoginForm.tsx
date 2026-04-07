"use client";

import { useState } from "react";
import Image from "next/image";
import { login, register } from "@/lib/auth";

interface Props {
  isSetup: boolean;
  onSuccess: () => void;
}

export default function LoginForm({ isSetup, onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "setup">(isSetup ? "setup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "setup") {
        await register(username, password, name);
      } else {
        await login(username, password);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/dongyang_logo.svg" alt="동양구조" width={48} height={48} className="mx-auto mb-4 opacity-70" />
          <h1 className="text-xl font-bold text-white">MIDAS GEN NX Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">(주)동양구조</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 text-center">
            {mode === "setup" ? "초기 관리자 계정 생성" : "로그인"}
          </h2>

          {mode === "setup" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">이름</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
                placeholder="홍길동" required
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">아이디</label>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
              placeholder="사용자 ID" required autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">비밀번호</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
              placeholder="비밀번호" required
            />
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 text-sm font-medium rounded-lg bg-[#669900] text-white hover:bg-[#5a8700] disabled:opacity-50 transition"
          >
            {loading ? "처리 중..." : mode === "setup" ? "관리자 계정 생성" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
