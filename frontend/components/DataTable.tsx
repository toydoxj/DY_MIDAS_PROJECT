"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface ColDef {
  key: string;
  label: string;
}

export type CellRenderer = (
  value: unknown,
  row: Record<string, unknown>,
) => ReactNode;

interface DataTableProps {
  columns: ColDef[];
  rows: Record<string, unknown>[];
  /** 하이라이트 대상 식별 키 (컬럼명) */
  highlightKey?: string;
  /** 하이라이트 대상 값 — 해당 행의 highlightKey 값이 이것과 일치하면 강조 */
  highlightValue?: string | number | null;
  /** true면 highlight 변경 시 해당 행으로 자동 스크롤 */
  scrollHighlightIntoView?: boolean;
  /** 특정 컬럼의 셀 렌더를 커스터마이즈 (key → 렌더 함수) */
  renderers?: Record<string, CellRenderer>;
  /** 행 클릭 핸들러 — 지정 시 행에 cursor-pointer 적용 */
  onRowClick?: (row: Record<string, unknown>) => void;
  /** 테이블 바디 최대 높이 (px). 넘치면 세로 스크롤. */
  maxBodyHeight?: number;
}

export default function DataTable({
  columns,
  rows,
  highlightKey,
  highlightValue,
  scrollHighlightIntoView = true,
  renderers,
  onRowClick,
  maxBodyHeight,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const colDefs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((c) => ({
        id: c.key,
        accessorKey: c.key,
        header: c.label,
        cell: ({ getValue, row }) => {
          const val = getValue();
          const customRenderer = renderers?.[c.key];
          if (customRenderer) {
            return customRenderer(val, row.original);
          }
          if (val === null || val === undefined) return "-";
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        },
      })),
    [columns, renderers]
  );

  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!scrollHighlightIntoView) return;
    if (highlightValue == null) return;
    highlightedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightValue, scrollHighlightIntoView]);

  const table = useReactTable({
    data: rows,
    columns: colDefs,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="검색..."
        className="w-full max-w-xs rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div
        className="overflow-x-auto rounded-lg border border-gray-700"
        style={
          maxBodyHeight
            ? { overflowY: "auto", maxHeight: maxBodyHeight }
            : undefined
        }
      >
        <table className="min-w-full text-sm">
          <thead className="bg-gray-700 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-white"
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ChevronUp size={14} />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronsUpDown size={14} className="text-gray-500" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-700">
            {table.getRowModel().rows.map((row, i) => {
              const isHi =
                !!highlightKey &&
                highlightValue != null &&
                String(row.original[highlightKey]) === String(highlightValue);
              const rowClasses = [
                isHi
                  ? "bg-[#669900]/25 outline outline-1 outline-[#669900]/60"
                  : i % 2 === 0
                  ? "bg-gray-800"
                  : "bg-gray-800/50",
                onRowClick ? "cursor-pointer hover:bg-gray-700/60 transition" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={row.id}
                  ref={isHi ? highlightedRowRef : undefined}
                  className={rowClasses}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-gray-300 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        총 {table.getFilteredRowModel().rows.length}개 행
      </p>
    </div>
  );
}
