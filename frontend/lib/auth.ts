import { AUTH_URL, BACKEND_URL } from "./types";

// 동양구조 업무관리(task.dyce.kr)와 키 통일 — SSO 호환
const TOKEN_KEY = "dy_auth_token";
const USER_KEY = "dy_auth_user";

// NAVER WORKS SSO — task SSO 공유(시나리오 A) 기준 직접 redirect 대상
const TASK_AUTH_BASE = AUTH_URL; // 보통 https://api.dyce.kr
// task 백엔드의 (user_id, client) 단위 세션 분리 키.
// task.dyce.kr 와 별개 활성 세션을 가지려면 반드시 'task' 가 아닌 값을 보내야 한다.
const SSO_CLIENT = "dy-midas";

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
  const res = await fetch(`${BACKEND_URL}/api/auth/status`);
  return res.json();
}

/** NAVER WORKS SSO 진입 URL.
 * - 브라우저 hard navigate 전용 (window.location.replace).
 * - task 백엔드(api.dyce.kr)가 state에 origin 포함 후 NAVER WORKS authorize로 302.
 * - Electron(app:// origin) 환경에서는 redirect 대상이 유효하지 않아 사용 불가.
 * - client=dy-midas 로 task.dyce.kr 와 별도 활성 세션을 보유 (이중 로그인 방지 회피).
 */
export function worksLoginUrl(next: string = "/"): string {
  const selfOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const qs = new URLSearchParams({
    next,
    front: selfOrigin,
    client: SSO_CLIENT,
  }).toString();
  return `${TASK_AUTH_BASE}/api/auth/works/login?${qs}`;
}

export interface WorksCallbackResult {
  token: string;
  user: AuthUser;
  next: string;
}

/** SSO callback fragment를 파싱.
 * - 입력: 전체 fragment 문자열 (앞 `#` 포함/미포함 모두 허용).
 * - task 백엔드 실제 스키마: `token=<JWT>&user=<base64-json>&next=<path>`
 *   - token: JWT 자체(점 포함). 디코딩하지 않고 그대로 access token으로 사용.
 *   - user: base64(url-safe 가능) → UTF-8 JSON of AuthUser.
 *   - next: 로그인 후 이동 경로 (기본 "/").
 * - 실패 시 null.
 */
export function decodeWorksToken(rawFragment: string): WorksCallbackResult | null {
  if (!rawFragment) return null;
  try {
    const stripped = rawFragment.startsWith("#") ? rawFragment.slice(1) : rawFragment;
    const params = new URLSearchParams(stripped);
    const token = params.get("token");
    const userRaw = params.get("user");
    const next = params.get("next") || "/";
    if (!token || !userRaw) return null;

    // user: base64(url-safe 허용) → UTF-8 JSON
    const b64 = userRaw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const decoded = atob(b64 + pad);
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    const user = JSON.parse(json) as AuthUser;
    if (!user || typeof user.id !== "number") return null;

    return { token, user, next };
  } catch {
    return null;
  }
}

/** SSO callback의 fragment 전체를 decodeWorksToken으로 위임.
 * - 성공 시 history.replaceState로 fragment 제거.
 * - 실패/누락 시 null 반환.
 */
export function consumeCallbackFragment(): WorksCallbackResult | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  if (!hash.startsWith("#")) return null;
  const result = decodeWorksToken(hash);
  if (!result) return null;
  try {
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", cleanUrl);
  } catch {
    /* ignore */
  }
  return result;
}

/** 본 앱 자체 access log에 로그인 이벤트 기록 — 로그인 성공 직후 호출.
 * - 인증 서버(task.dyce.kr)와 별개로 이 sidecar의 SQLite에 적재.
 * - JWT의 sid가 UNIQUE 키 → 같은 세션 재요청은 백엔드가 무시.
 * - 실패해도 로그인 흐름은 막지 않는다(silent).
 * - authFetch(401시 자동 clearAuth+redirect) 대신 raw fetch — 추적 실패가
 *   방금 성공한 SSO 세션을 날려서 로그인 화면으로 튕기는 사고를 방지.
 */
export async function trackLogin(appVersion?: string): Promise<void> {
  try {
    let version = appVersion || "";
    if (!version && typeof window !== "undefined") {
      try {
        version = (await window.electronAPI?.getVersion?.()) || "";
      } catch { /* ignore */ }
    }
    const token = getToken();
    if (!token) return;
    await fetch(`${BACKEND_URL}/api/admin/track-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ app_version: version }),
    });
  } catch {
    /* ignore — 추적 실패가 로그인 성공을 막지 않게 */
  }
}

