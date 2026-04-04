import { BACKEND_URL } from "@/lib/types";
import type { SectionRebarInput } from "./types";

const LS_KEY = "rc-beam-rebars-draft";

/* ── localStorage (임시 저장) ── */

export function saveDraftToLocal(sections: SectionRebarInput[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sections));
  } catch { /* ignore */ }
}

export function loadDraftFromLocal(): SectionRebarInput[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearDraftLocal(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

/* ── 서버 JSON 파일 (영구 저장) ── */

export async function loadRebarsFromServer(): Promise<SectionRebarInput[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/member/rebars`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sections ?? [];
  } catch { return []; }
}

export async function saveRebarsToServer(sections: SectionRebarInput[]): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/member/rebars`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        sections,
      }),
    });
    return res.ok;
  } catch { return false; }
}
