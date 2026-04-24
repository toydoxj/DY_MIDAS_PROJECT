"use client";

import { useMemo } from "react";
import { Popover } from "radix-ui";
import { Plus, Trash2, Info } from "lucide-react";
import type { SlabSectionItem, SlabSectionType } from "../_lib/types";
import { emptySlabSection } from "../_lib/types";

interface Props {
  sections: SlabSectionItem[];
  onChange: (next: SlabSectionItem[]) => void;
  /** 분석 결과에서 수집된 분류명 (예: ["S1","RS1",...]). 누락된 분류는 자동 보강 안내용. */
  autoNames: string[];
}

const TYPE_OPTIONS: SlabSectionType[] = ["", "A", "B", "C", "D", "E"];

const COL_WIDTHS = "min-w-[72px]";

export default function SlabSectionsTable({ sections, onChange, autoNames }: Props) {
  const existingNames = useMemo(
    () => new Set(sections.map((s) => s.name.trim()).filter(Boolean)),
    [sections],
  );
  const missingNames = useMemo(
    () => autoNames.filter((n) => n && !existingNames.has(n)),
    [autoNames, existingNames],
  );

  const updateField = <K extends keyof SlabSectionItem>(
    index: number,
    key: K,
    value: SlabSectionItem[K],
  ) => {
    const next = sections.slice();
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const addRow = (presetName: string = "") => {
    onChange([...sections, emptySlabSection(presetName)]);
  };

  const removeRow = (index: number) => {
    const next = sections.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const addAllMissing = () => {
    onChange([...sections, ...missingNames.map((n) => emptySlabSection(n))]);
  };

  return (
    <div className="space-y-3">
      {missingNames.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
          <span>
            배근표에 없는 분류 {missingNames.length}개:{" "}
            <span className="font-mono">{missingNames.join(", ")}</span>
          </span>
          <button
            type="button"
            onClick={addAllMissing}
            className="rounded border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[11px] hover:bg-amber-500/30 transition"
          >
            자동 추가
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-700">
            <tr className="text-[10px] uppercase tracking-wider text-gray-300">
              <th className={`px-3 py-2 text-left font-semibold ${COL_WIDTHS}`}>NAME</th>
              <th className="px-3 py-2 text-left font-semibold">
                <span className="inline-flex items-center gap-1">
                  TYPE
                  <TypeInfoPopover />
                </span>
              </th>
              <th className="px-3 py-2 text-right font-semibold">THK(mm)</th>
              {(["X1", "X2", "X3", "X4", "X5"] as const).map((k) => (
                <th key={k} className={`px-2 py-2 text-left font-semibold ${COL_WIDTHS}`}>
                  {k}
                </th>
              ))}
              {(["Y1", "Y2", "Y3", "Y4", "Y5"] as const).map((k) => (
                <th key={k} className={`px-2 py-2 text-left font-semibold ${COL_WIDTHS}`}>
                  {k}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-semibold min-w-[100px]">메모</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sections.map((s, i) => (
              <tr
                key={`${s.name}-${i}`}
                className={i % 2 === 0 ? "bg-gray-800" : "bg-gray-800/50"}
              >
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => updateField(i, "name", e.target.value)}
                    placeholder="S1"
                    className="w-full rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white focus:border-[#669900] focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={s.type}
                    onChange={(e) =>
                      updateField(i, "type", e.target.value as SlabSectionType)
                    }
                    className="w-16 rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white focus:border-[#669900] focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t || "none"} value={t}>
                        {t || "—"}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={s.thk ?? ""}
                    onChange={(e) =>
                      updateField(
                        i,
                        "thk",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    placeholder="200"
                    className="w-20 rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-right text-sm text-white focus:border-[#669900] focus:outline-none"
                  />
                </td>
                {(["x1", "x2", "x3", "x4", "x5", "y1", "y2", "y3", "y4", "y5"] as const).map(
                  (k) => (
                    <td key={k} className="px-1 py-1.5">
                      <input
                        type="text"
                        value={s[k]}
                        onChange={(e) => updateField(i, k, e.target.value)}
                        placeholder="HD13@200"
                        className="w-full min-w-[80px] rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white placeholder-gray-600 focus:border-[#669900] focus:outline-none"
                      />
                    </td>
                  ),
                )}
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={s.note}
                    onChange={(e) => updateField(i, "note", e.target.value)}
                    className="w-full rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white focus:border-[#669900] focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-gray-500 hover:text-red-400 transition"
                    title="행 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr>
                <td
                  colSpan={15}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  배근표가 비어있습니다. 아래 「+ 행 추가」 또는 상단 「자동 추가」로
                  시작하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => addRow("")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition"
        >
          <Plus size={14} />
          행 추가
        </button>
        <span className="text-[11px] text-gray-500">
          · 분류명 입력 시 동일 분류의 모든 패널에 자동 공유 · 500ms 후 자동 저장
        </span>
      </div>
    </div>
  );
}

function TypeInfoPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 transition"
          title="TYPE 참조도 보기"
        >
          <Info size={11} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={6}
          className="z-50 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl text-xs text-gray-200 max-w-[380px]"
        >
          <p className="mb-2 font-semibold">TYPE A~E 슬래브 배근 분류</p>
          <ul className="space-y-1 text-gray-400 text-[11px] leading-relaxed">
            <li>
              <span className="text-amber-300 font-mono">A</span> — 4변 고정 2방향
              슬래브. X1~X5, Y1~Y5 전부 사용.
            </li>
            <li>
              <span className="text-amber-300 font-mono">B</span> — 단부 연속/불연속
              조합.
            </li>
            <li>
              <span className="text-amber-300 font-mono">C</span> — 1방향 슬래브. X
              방향 주철근 + Y 방향 배력근.
            </li>
            <li>
              <span className="text-amber-300 font-mono">D</span> — 3변 연속 + 1변
              단순지지 등 혼합.
            </li>
            <li>
              <span className="text-amber-300 font-mono">E</span> — 캔틸레버. 상부
              철근(X1~X2)이 주요.
            </li>
          </ul>
          <p className="mt-2 text-[10px] text-gray-500">
            각 위치(X1~X5, Y1~Y5)는 TOP BAR(실선) / BOTTOM BAR(점선) 배근을 의미.
          </p>
          <Popover.Arrow className="fill-gray-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
