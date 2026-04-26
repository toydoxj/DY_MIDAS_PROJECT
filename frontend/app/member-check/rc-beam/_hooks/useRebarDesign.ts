"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/types";
import { initSectionRebars } from "../_components/RebarInputTable";
import { saveDraftToLocal, loadDraftFromLocal, clearDraftLocal, saveRebarsToServer } from "../_lib/storage";
import type { SectionRebarInput, RebarType, PositionCheckResult } from "../_lib/types";

/**
 * RC 보 배근 입력/검토 훅.
 *
 * 책임:
 *  - rebarSections 상태 관리 (maxResult 변경 시 서버/draft/기본값 병합으로 초기화)
 *  - localStorage draft 자동 저장 (1초 디바운스)
 *  - 자동 검토 실행 (300ms 디바운스, AbortController + unmount cleanup)
 *  - 서버 저장 (handleSaveRebars)
 *
 * 외부 의존성(defaults, getFyForDia, savedRebars)은 ref로 캡처해
 * maxResult effect 의존성을 maxResult만으로 유지한다 (3-A codex 권고).
 */

interface BeamForceMaxRowLite {
  SectName: string;
  B: number | null;
  H: number | null;
  My_neg_I: number;
  My_neg_J: number;
  // ...rest
}

interface DefaultsLite {
  fck: number;
  fy: number;
  fyt: number;
}

export interface UseRebarDesignArgs<MR extends BeamForceMaxRowLite> {
  maxResult: MR[] | null;
  savedRebars: SectionRebarInput[];
  setSavedRebars: (s: SectionRebarInput[]) => void;
  defaults: DefaultsLite;
  getFyForDia: (dia: number) => number;
  /** 부재력 기반 rebarType 자동 판정 함수 */
  autoDetectRebarType: (force: MR) => { rebarType: RebarType; swapIJ: boolean };
  /** 에러 메시지 외부 노출 */
  onError?: (msg: string) => void;
}

export interface UseRebarDesign {
  rebarSections: SectionRebarInput[];
  setRebarSections: Dispatch<SetStateAction<SectionRebarInput[]>>;
  checkResults: PositionCheckResult[];
  checkLoading: boolean;
  rebarSaving: boolean;
  rebarSaved: boolean;
  handleSaveRebars: () => Promise<void>;
}

export function useRebarDesign<MR extends BeamForceMaxRowLite>(
  { maxResult, savedRebars, setSavedRebars, defaults, getFyForDia, autoDetectRebarType, onError }: UseRebarDesignArgs<MR>,
): UseRebarDesign {
  const [rebarSections, setRebarSections] = useState<SectionRebarInput[]>([]);
  const [checkResults, setCheckResults] = useState<PositionCheckResult[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [rebarSaving, setRebarSaving] = useState(false);
  const [rebarSaved, setRebarSaved] = useState(false);

  // maxResult effect 의존성을 maxResult만으로 유지하기 위해 변동 deps는 ref로 캡처
  const savedRebarsRef = useRef(savedRebars);
  const defaultsRef = useRef(defaults);
  const getFyForDiaRef = useRef(getFyForDia);
  const autoDetectRef = useRef(autoDetectRebarType);
  useEffect(() => { savedRebarsRef.current = savedRebars; }, [savedRebars]);
  useEffect(() => { defaultsRef.current = defaults; }, [defaults]);
  useEffect(() => { getFyForDiaRef.current = getFyForDia; }, [getFyForDia]);
  useEffect(() => { autoDetectRef.current = autoDetectRebarType; }, [autoDetectRebarType]);

  // maxResult 변경 시 저장 데이터와 병합 (서버 우선, localStorage 보조)
  useEffect(() => {
    if (!maxResult || maxResult.length === 0) {
      setRebarSections([]);
      return;
    }
    const serverMap = new Map(savedRebarsRef.current.map((s) => [s.section_name, s]));
    const draft = loadDraftFromLocal();
    const draftMap = draft ? new Map(draft.map((s) => [s.section_name, s])) : null;

    setRebarSections(
      maxResult.map((r) => {
        const fromServer = serverMap.get(r.SectName);
        const fromDraft = draftMap?.get(r.SectName);
        const existing = fromServer ?? fromDraft;
        if (existing) return { ...existing, B: r.B ?? existing.B, H: r.H ?? existing.H };
        const { rebarType } = autoDetectRef.current(r);
        const d = defaultsRef.current;
        const init = initSectionRebars(r.SectName, r.B ?? 400, r.H ?? 700, d.fck, getFyForDiaRef.current(25), d.fyt);
        return { ...init, rebarType };
      })
    );
    setCheckResults([]);
  }, [maxResult]);

  // localStorage 자동 저장 (1초 디바운스)
  useEffect(() => {
    if (rebarSections.length === 0) return;
    const timer = setTimeout(() => saveDraftToLocal(rebarSections), 1000);
    return () => clearTimeout(timer);
  }, [rebarSections]);

  // 검토 실행 (수동 트리거용)
  const checkAbortRef = useRef<AbortController | null>(null);

  // unmount 시 진행 중 검토 abort
  useEffect(() => {
    return () => { checkAbortRef.current?.abort(); };
  }, []);

  const runDesignCheck = useCallback(async () => {
    if (!maxResult || rebarSections.length === 0) return;
    checkAbortRef.current?.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;
    setCheckLoading(true);
    try {
      // rebarType에 따라 검토용 rebars 변환
      const adjustedSections = rebarSections.map((sec) => {
        const rType = sec.rebarType;
        if (rType === "type3") return sec;
        if (rType === "type2") {
          const iRebar = sec.rebars[0];
          return {
            ...sec,
            rebars: sec.rebars.map((r) =>
              r.position === "J"
                ? { ...r, top_dia: iRebar.top_dia, top_count: iRebar.top_count, bot_dia: iRebar.bot_dia, bot_count: iRebar.bot_count, stirrup_dia: iRebar.stirrup_dia, stirrup_legs: iRebar.stirrup_legs, stirrup_spacing: iRebar.stirrup_spacing, cover: iRebar.cover }
                : r
            ),
          };
        }
        const iRebar = sec.rebars[0];
        return {
          ...sec,
          rebars: sec.rebars.map((r) => ({
            ...r, top_dia: iRebar.top_dia, top_count: iRebar.top_count, bot_dia: iRebar.bot_dia, bot_count: iRebar.bot_count, stirrup_dia: iRebar.stirrup_dia, stirrup_legs: iRebar.stirrup_legs, stirrup_spacing: iRebar.stirrup_spacing, cover: iRebar.cover,
          })),
        };
      });
      const body = { sections: adjustedSections, forces: maxResult };
      const res = await fetch(`${BACKEND_URL}/api/member/beam-design-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setCheckResults(await res.json());
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      onError?.(String(e));
    } finally {
      if (!controller.signal.aborted) setCheckLoading(false);
    }
  }, [maxResult, rebarSections, onError]);

  // 배근/재료 변경 시 자동 검토 (300ms 디바운스)
  useEffect(() => {
    if (!maxResult || rebarSections.length === 0) return;
    const timer = setTimeout(() => { void runDesignCheck(); }, 300);
    return () => clearTimeout(timer);
  }, [runDesignCheck, maxResult, rebarSections]);

  // 서버에 배근 저장 (기존 저장 데이터와 병합)
  const handleSaveRebars = useCallback(async () => {
    setRebarSaving(true);
    setRebarSaved(false);
    const currentMap = new Map(rebarSections.map((s) => [s.section_name, s]));
    const merged = [...savedRebarsRef.current.filter((s) => !currentMap.has(s.section_name)), ...rebarSections];
    const ok = await saveRebarsToServer(merged);
    if (ok) {
      setRebarSaved(true);
      clearDraftLocal();
      setSavedRebars(merged);
    }
    setRebarSaving(false);
  }, [rebarSections, setSavedRebars]);

  return {
    rebarSections,
    setRebarSections,
    checkResults,
    checkLoading,
    rebarSaving,
    rebarSaved,
    handleSaveRebars,
  };
}
