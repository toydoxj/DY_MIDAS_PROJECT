import { AUTH_URL } from "./types";

// 동양구조 업무관리(task.dyce.kr)와 키 통일 — SSO 호환
const TOKEN_KEY = "dy_auth_token";
const USER_KEY = "dy_auth_user";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  email?: string; // 동양구조 응답에 추가됨
  role: string;
  status?: string;
  midas_url: string;
  work_dir: string;
  has_midas_key: boolean;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem(USER_KEY);
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 인증 헤더가 포함된 fetch 래퍼 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  return res;
}

/** 인증 상태 확인 (DB에 사용자가 있는지) */
export async function checkAuthStatus(): Promise<{ initialized: boolean }> {
  const res = await fetch(`${AUTH_URL}/api/auth/status`);
  return res.json();
}

/** 로그인 */
export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${AUTH_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `로그인 실패 (${res.status})`);
  }
  const d = await res.json();
  saveAuth(d.access_token, d.user);
  return { token: d.access_token, user: d.user };
}

/** 가입 신청 (동양구조 백엔드의 /api/auth/request로 위임).
 * 자동 승인은 task.dyce.kr 직원 명부에 이메일이 등록되어 있을 때.
 */
export async function requestJoin(
  username: string,
  password: string,
  name: string,
  email: string,
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${AUTH_URL}/api/auth/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, name, email }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `가입 신청 실패 (${res.status})`);
  }
  return res.json();
}
