"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

/**
 * RC 보 페이지의 층/단면 선택 state를 모아 관리하는 훅.
 *
 * 책임 경계:
 *  - 소유: selectedStories, selectedIds, 그로부터 파생되는 selection 정보
 *  - 비소유: sections/stories 자체(상위에서 주입), 부재력 결과(maxResult 등),
 *           UI 상태(dropdownOpen 등)
 *
 * 호출 측에서 sections가 새로 로드되면 자동으로 보이지 않는 선택은 제거된다.
 * clearSelection 은 selection만 비우며, 결과 초기화(setMaxResult 등)는
 * 호출 측에서 별도로 처리해야 한다 (책임 분리).
 */
export interface SectionInfoLike {
  id: number;
  name: string;
  element_count: number;
  element_keys: number[];
}

export interface UseRcBeamSelectionArgs<S extends SectionInfoLike> {
  sections: S[];
  filterByStories: (sects: S[], stories: Set<string>) => S[];
}

export interface UseRcBeamSelection<S extends SectionInfoLike> {
  selectedStories: Set<string>;
  setSelectedStories: Dispatch<SetStateAction<Set<string>>>;
  selectedIds: Set<number>;
  selectedSections: S[];
  selectedKeys: number[];
  selectedNames: string[];
  filteredSections: S[];
  totalElements: number;
  toggleSection: (id: number) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
}

export function useRcBeamSelection<S extends SectionInfoLike>(
  { sections, filterByStories }: UseRcBeamSelectionArgs<S>,
): UseRcBeamSelection<S> {
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const filteredSections = useMemo(
    () => filterByStories(sections, selectedStories),
    [sections, selectedStories, filterByStories],
  );

  // 층 필터 변경 시 보이지 않게 된 선택은 자동 해제
  useEffect(() => {
    const visibleIds = new Set(filteredSections.map((s) => s.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredSections]);

  const selectedSections = useMemo(
    () => sections.filter((s) => selectedIds.has(s.id)),
    [sections, selectedIds],
  );

  const selectedKeys = useMemo(() => {
    const keys: number[] = [];
    for (const s of selectedSections) keys.push(...s.element_keys);
    return keys;
  }, [selectedSections]);

  const selectedNames = useMemo(
    () => selectedSections.map((s) => s.name),
    [selectedSections],
  );

  const totalElements = useMemo(
    () => selectedSections.reduce((sum, s) => sum + s.element_count, 0),
    [selectedSections],
  );

  const toggleSection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredSections.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedStories,
    setSelectedStories,
    selectedIds,
    selectedSections,
    selectedKeys,
    selectedNames,
    filteredSections,
    totalElements,
    toggleSection,
    selectAllVisible,
    clearSelection,
  };
}
