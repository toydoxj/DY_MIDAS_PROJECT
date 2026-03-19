import ChartPanel from "@/components/ChartPanel";
import DataTable from "@/components/DataTable";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface StorItem {
  KEY: string;
  STORY_NAME: string;
  ELEV: number;
  HEIGHT: number;
  [key: string]: unknown;
}

async function fetchStorData(): Promise<StorItem[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/midas/STOR`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const assign = json?.Assign ?? {};
    return Object.entries(assign).map(([key, val]) => ({
      KEY: key,
      ...(val as Record<string, unknown>),
    })) as StorItem[];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const stories = await fetchStorData();

  const chartData = stories.map((s) => ({
    name: s.STORY_NAME ?? s.KEY,
    높이: typeof s.HEIGHT === "number" ? s.HEIGHT : 0,
    레벨: typeof s.ELEV === "number" ? s.ELEV : 0,
  }));

  const columns =
    stories.length > 0
      ? Object.keys(stories[0]).map((k) => ({ key: k, label: k }))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-gray-400 mt-1">MIDAS GEN NX 층 정보 (STOR)</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <p className="text-sm text-gray-400">총 층수</p>
          <p className="text-3xl font-bold text-blue-400">{stories.length}</p>
        </div>
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <p className="text-sm text-gray-400">최고 레벨 (mm)</p>
          <p className="text-3xl font-bold text-green-400">
            {stories.length > 0
              ? Math.max(
                  ...stories.map((s) =>
                    typeof s.ELEV === "number" ? s.ELEV : 0
                  )
                ).toLocaleString()
              : "-"}
          </p>
        </div>
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <p className="text-sm text-gray-400">최대 층고 (mm)</p>
          <p className="text-3xl font-bold text-purple-400">
            {stories.length > 0
              ? Math.max(
                  ...stories.map((s) =>
                    typeof s.HEIGHT === "number" ? s.HEIGHT : 0
                  )
                ).toLocaleString()
              : "-"}
          </p>
        </div>
      </div>

      {/* 차트 */}
      {chartData.length > 0 && (
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            층별 레벨 / 층고 차트
          </h2>
          <ChartPanel data={chartData} />
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">층 데이터 테이블</h2>
        {stories.length > 0 ? (
          <DataTable columns={columns} rows={stories} />
        ) : (
          <p className="text-gray-500">
            데이터가 없습니다. 백엔드 서버 및 MIDAS GEN NX 연결을 확인하세요.
          </p>
        )}
      </div>
    </div>
  );
}
