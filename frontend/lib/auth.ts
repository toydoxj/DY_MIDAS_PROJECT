import { AUTH_URL } from "./types";

const TOKEN_KEY = "midas_auth_token";
const USER_KEY = "midas_auth_user";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
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

/** 최초 관리자 등록 */
export async function register(username: string, password: string, name: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${AUTH_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, name }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `등록 실패 (${res.status})`);
  }
  const d = await res.json();
  saveAuth(d.access_token, d.user);
  return { token: d.access_token, user: d.user };
}
