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
    const head = target.HEAD as string[];
    const rows = target.DATA as unknown[][];
    return rows.map((row) => {
      const record: Record<string, unknown> = {};
      head.forEach((col, i) => { record[col] = row[i] ?? ""; });
      return record;
    });
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
