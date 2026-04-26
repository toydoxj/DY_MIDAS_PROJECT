"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/types";
import { flattenResponse } from "@/lib/utils";
import { loadRebarsFromServer } from "../_lib/storage";
import type { SectionRebarInput } from "../_lib/types";

/**
 * RC 보 페이지의 모든 MIDAS API 호출을 모은 훅.
 *
 * 책임:
 *  - 단면/층/프로젝트 재료/서버 저장 배근 초기 로드 (mount 시 자동)
 *  - 부재력 최대값 + 부재별 결과 조회 (fetchDesignResult)
 *  - 원시 테이블 lazy 조회 (fetchRawData)
 *  - 모든 호출에 AbortController 적용 (latest-only + unmount cleanup)
 *
 * 외부에서 maxResult 변경을 감지해 검토/배근 초기화하므로 결과는 state로 노출.
 * resetResults()는 selection 변경 시 호출 측에서 직접 호출 (책임 분리).
 */

interface SectionInfoLite {
  id: number;
  name: string;
  type: string;
  element_count: number;
  element_keys: number[];
}

interface StoryItemLite {
  name: string;
  level: number;
}

interface BeamForceMaxRowLite {
  SectName: string;
  B: number | null;
  H: number | null;
  D: number | null;
  My_neg_I_LC: string; My_neg_I: number;
  My_pos_I_LC: string; My_pos_I: number;
  Fz_I_LC: string; Fz_I: number;
  My_neg_C_LC: string; My_neg_C: number;
  My_pos_C_LC: string; My_pos_C: number;
  Fz_C_LC: string; Fz_C: number;
  My_neg_J_LC: string; My_neg_J: number;
  My_pos_J_LC: string; My_pos_J: number;
  Fz_J_LC: string; Fz_J: number;
}

interface MemberForceMaxRowLite {
  Memb: number;
  My_neg_I_LC: string; My_neg_I: number;
  My_pos_I_LC: string; My_pos_I: number;
  Fz_I_LC: string; Fz_I: number;
  My_neg_C_LC: string; My_neg_C: number;
  My_pos_C_LC: string; My_pos_C: number;
  Fz_C_LC: string; Fz_C: number;
  My_neg_J_LC: string; My_neg_J: number;
  My_pos_J_LC: string; My_pos_J: number;
  Fz_J_LC: string; Fz_J: number;
}

export interface RebarRule { strength: number; dia_threshold: number; dia_dir: string }

export interface MaterialDefaults {
  fck: number;
  fy: number;
  fyt: number;
  rebarRules: RebarRule[];
}

export interface UseMidasFetch<S extends SectionInfoLite, ST extends StoryItemLite, MR extends BeamForceMaxRowLite, MMR extends MemberForceMaxRowLite> {
  // state
  sections: S[];
  stories: ST[];
  result: Record<string, unknown>[] | null;
  maxResult: MR[] | null;
  memberResult: MMR[] | null;
  savedRebars: SectionRebarInput[];
  defaults: MaterialDefaults;
  loadingSections: boolean;
  loadingResult: boolean;
  error: string;
  lastFetchedAt: string | null;

  // actions
  fetchSections: () => Promise<void>;
  fetchDesignResult: (sectionNames: string[], forceRefresh?: boolean) => Promise<void>;
  fetchRawData: (keys: number[]) => Promise<void>;
  resetResults: () => void;
  setError: (s: string) => void;
  setSavedRebars: (s: SectionRebarInput[]) => void;
}

/** 표준 에러 메시지 추출 (선택사항: 호출 측이 prefix 추가) */
function parseError(e: unknown, fallback = "오류"): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : fallback;
}

export function useMidasFetch<
  S extends SectionInfoLite,
  ST extends StoryItemLite,
  MR extends BeamForceMaxRowLite,
  MMR extends MemberForceMaxRowLite,
>(): UseMidasFetch<S, ST, MR, MMR> {
  const [sections, setSections] = useState<S[]>([]);
  const [stories, setStories] = useState<ST[]>([]);
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null);
  const [maxResult, setMaxResult] = useState<MR[] | null>(null);
  const [memberResult, setMemberResult] = useState<MMR[] | null>(null);
  const [savedRebars, setSavedRebars] = useState<SectionRebarInput[]>([]);
  const [defaults, setDefaults] = useState<MaterialDefaults>({
    fck: 27, fy: 400, fyt: 400, rebarRules: [],
  });
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // latest-only + unmount cleanup을 위한 단일 abort ref (조회/raw 공용)
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const resetResults = useCallback(() => {
    setResult(null);
    setMaxResult(null);
    setMemberResult(null);
  }, []);

  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    setError("");
    try {
      const [sectRes, storRes, projRes, rebarsData] = await Promise.all([
        fetch(`${BACKEND_URL}/api/member/sections`),
        fetch(`${BACKEND_URL}/api/midas/db/STOR`),
        fetch(`${BACKEND_URL}/api/project`),
        loadRebarsFromServer(),
      ]);
      if (!sectRes.ok) throw new Error(`Section HTTP ${sectRes.status}`);
      const data = (await sectRes.json()) as S[];
      setSections(data);
      resetResults();

      // STOR 층 정보
      if (storRes.ok) {
        const storRaw = await storRes.json();
        const stor = storRaw.STOR ?? {};
        const items = Object.values(stor)
          .filter((v): v is { STORY_NAME: string; STORY_LEVEL: number } =>
            typeof v === "object" && v !== null && "STORY_NAME" in v)
          .map((v) => ({ name: v.STORY_NAME, level: v.STORY_LEVEL }))
          .sort((a, b) => a.level - b.level) as ST[];
        setStories(items);
      }

      // 대시보드 재료 강도 기본값
      if (projRes.ok) {
        try {
          const proj = await projRes.json();
          const c = JSON.parse(proj.COMMENT ?? "{}");
          const mat = c.MATERIALS_V2;
          let nextFck = 27;
          let nextFy = 400;
          let nextFyt = 400;
          let nextRules: RebarRule[] = [];
          if (mat?.concrete?.[0]?.strength) nextFck = Number(mat.concrete[0].strength);
          if (mat?.rebar && Array.isArray(mat.rebar)) {
            nextRules = mat.rebar.map((r: { strength?: number; dia_threshold?: number; dia_dir?: string }) => ({
              strength: Number(r.strength ?? 400),
              dia_threshold: Number(r.dia_threshold ?? 0),
              dia_dir: r.dia_dir ?? "전부재",
            }));
            const allRule = nextRules.find((r) => r.dia_dir === "전부재");
            const baseStrength = allRule?.strength ?? nextRules[0]?.strength ?? 400;
            nextFy = baseStrength;
            nextFyt = baseStrength;
          }
          setDefaults({ fck: nextFck, fy: nextFy, fyt: nextFyt, rebarRules: nextRules });
        } catch { /* COMMENT 파싱 실패는 무시 (재료 기본값 유지) */ }
      }

      setSavedRebars(rebarsData);
    } catch (e) {
      setError(`Section 조회 실패: ${parseError(e)}`);
    } finally {
      setLoadingSections(false);
    }
  }, [resetResults]);

  // mount 시 자동 초기 로드 (호출 측에서 의존성 줄이기)
  useEffect(() => {
    void fetchSections();
  }, [fetchSections]);

  const fetchDesignResult = useCallback(async (sectionNames: string[], forceRefresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingResult(true);
    setError("");
    setMaxResult(null);
    setMemberResult(null);
    setResult(null); // 새 selection 조회 시 원시 데이터 캐시도 무효화 (탭 재진입 시 fetchRawData 재호출)

    try {
      const fetchOpts = (body: unknown) => ({
        method: "POST",
        headers: { "Content-Type": "application/json" } as Record<string, string>,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      // section → member 순차 호출 (첫 호출이 캐시를 채워 동시 호출 시 502 방지)
      const maxRes = await fetch(`${BACKEND_URL}/api/member/beam-force-max`, fetchOpts({
        section_names: sectionNames, group_by: "section", force_refresh: forceRefresh,
      }));
      if (controller.signal.aborted) return;
      if (!maxRes.ok) {
        const errData = await maxRes.json().catch(() => ({}));
        throw new Error(errData?.detail ?? errData?.error?.message ?? `최대값 조회 HTTP ${maxRes.status}`);
      }
      const maxData = (await maxRes.json()) as MR[];

      const memberRes = await fetch(`${BACKEND_URL}/api/member/beam-force-max`, fetchOpts({
        section_names: sectionNames, group_by: "member", force_refresh: false,
      }));
      if (controller.signal.aborted) return;
      if (!memberRes.ok) {
        const errData = await memberRes.json().catch(() => ({}));
        throw new Error(errData?.detail ?? errData?.error?.message ?? `부재별 조회 HTTP ${memberRes.status}`);
      }
      const memberData = (await memberRes.json()) as MMR[];

      if (controller.signal.aborted) return;

      setMaxResult(maxData);
      setMemberResult(memberData);
      setLastFetchedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(`설계결과 조회 실패: ${parseError(e)}`);
    } finally {
      if (!controller.signal.aborted) setLoadingResult(false);
    }
  }, []);

  // 전체 데이터 탭 클릭 시에만 원시 데이터 조회 (lazy)
  const fetchRawData = useCallback(async (keys: number[]) => {
    if (result) return; // 이미 조회됨
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingResult(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/midas/post/TABLE`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          Argument: {
            TABLE_TYPE: "BEAMDESIGNFORCES",
            UNIT: { FORCE: "KN", DIST: "M" },
            STYLES: { FORMAT: "Fixed", PLACE: 1 },
            NODE_ELEMS: { KEYS: keys },
            PARTS: ["PartI", "Part2/4", "PartJ"],
            COMPONENTS: ["Memb", "Part", "LComName", "Type", "Fz", "My(-)", "My(+)"],
          },
        }),
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(flattenResponse(data));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(`전체 데이터 조회 실패: ${parseError(e)}`);
    } finally {
      if (!controller.signal.aborted) setLoadingResult(false);
    }
  }, [result]);

  return {
    sections,
    stories,
    result,
    maxResult,
    memberResult,
    savedRebars,
    defaults,
    loadingSections,
    loadingResult,
    error,
    lastFetchedAt,
    fetchSections,
    fetchDesignResult,
    fetchRawData,
    resetResults,
    setError,
    setSavedRebars,
  };
}
