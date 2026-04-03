/**
 * HEAD+DATA 형식을 Record 배열로 변환한다.
 */
function headDataToRows(target: Record<string, unknown>): Record<string, unknown>[] {
  const head = target.HEAD as string[];
  const rows = target.DATA as unknown[][];
  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    head.forEach((col, i) => { record[col] = row[i] ?? ""; });
    return record;
  });
}

/**
 * HEAD+DATA 형식의 MIDAS API 응답을 Record 배열로 평탄화한다.
 */
export function flattenResponse(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];

  const obj = data as Record<string, unknown>;

  // HEAD + DATA 형식 감지 (직접 또는 중첩)
  const target = obj.HEAD && obj.DATA ? obj : Object.values(obj).find(
    (v) => v && typeof v === "object" && !Array.isArray(v) && (v as Record<string, unknown>).HEAD && (v as Record<string, unknown>).DATA
  ) as Record<string, unknown> | undefined;

  if (target) {
    return headDataToRows(target);
  }

  // 기존 중첩 dict 처리
  const firstKey = Object.keys(obj)[0];
  if (firstKey && typeof obj[firstKey] === "object" && !Array.isArray(obj[firstKey])) {
    const inner = obj[firstKey] as Record<string, unknown>;
    const values = Object.values(inner);
    if (values.length > 0 && typeof values[0] === "object" && values[0] !== null) {
      return Object.entries(inner).map(([k, v]) => ({ KEY: k, ...(v as Record<string, unknown>) }));
    }
  }
  return [obj];
}

export interface SubTableData {
  name: string;
  rows: Record<string, unknown>[];
}

/**
 * SUB_TABLES가 있는 /post/TABLE 응답에서 서브테이블 목록을 추출한다.
 */
export function extractSubTables(data: unknown): SubTableData[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;

  // 최상위 키 내부에서 SUB_TABLES 탐색 (예: data.EigenvalueMode.SUB_TABLES)
  const inner = Object.values(obj).find(
    (v) => v && typeof v === "object" && !Array.isArray(v) && (v as Record<string, unknown>).SUB_TABLES
  ) as Record<string, unknown> | undefined;

  const subTables = (inner?.SUB_TABLES ?? obj.SUB_TABLES) as unknown[] | undefined;
  if (!Array.isArray(subTables)) return [];

  const results: SubTableData[] = [];
  for (const entry of subTables) {
    if (!entry || typeof entry !== "object") continue;
    for (const [name, val] of Object.entries(entry as Record<string, unknown>)) {
      const table = val as Record<string, unknown>;
      if (table.HEAD && table.DATA) {
        results.push({ name, rows: headDataToRows(table) });
      }
    }
  }
  return results;
}
