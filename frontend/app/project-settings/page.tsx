"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Wand2, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/ui/StatusMessage";
import { BACKEND_URL } from "@/lib/types";
import type {
  GridAxisGroup,
  GridAxisItem,
  GridLabelFormat,
  ProjectGridSettings,
} from "./_lib/types";

const DEFAULT_SETTINGS: ProjectGridSettings = {
  angle_deg: 0,
  origin: [0, 0],
  x_axes: [],
  y_axes: [],
  label_format: "prefix",
  auto_detected: false,
  extra_groups: [],
};

const GROUP_COLOR_PALETTE = [
  "#fb923c", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#22d3ee",
];

export default function ProjectSettingsPage() {
  const [settings, setSettings] = useState<ProjectGridSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [posTol, setPosTol] = useState<number>(500);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/project-settings/grid`);
      if (!res.ok) throw new Error(`설정 조회 실패 (${res.status})`);
      const data: ProjectGridSettings = await res.json();
      setSettings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/project-settings/grid`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `저장 실패 (${res.status})`);
      }
      setNotice("저장되었습니다");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [settings]);

  const applyAutoDetect = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const url = new URL(`${BACKEND_URL}/api/project-settings/grid/apply-auto-detect`);
      url.searchParams.set("pos_tol_mm", String(posTol));
      url.searchParams.set("label_format", settings.label_format);
      const res = await fetch(url.toString(), { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `자동 탐지 실패 (${res.status})`);
      }
      const data: ProjectGridSettings = await res.json();
      setSettings(data);
      setNotice(`자동 탐지 완료 (X ${data.x_axes.length} / Y ${data.y_axes.length})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [posTol, settings.label_format]);

  const updateAxis = (
    axis: "x_axes" | "y_axes",
    index: number,
    key: keyof GridAxisItem,
    value: string | number,
  ) => {
    setSettings((prev) => {
      const arr = prev[axis].slice();
      arr[index] = { ...arr[index], [key]: value };
      return { ...prev, [axis]: arr };
    });
  };

  const addAxis = (axis: "x_axes" | "y_axes") => {
    setSettings((prev) => {
      const arr = prev[axis].slice();
      const prefix = axis === "x_axes" ? "X" : "Y";
      const fallback = `${prefix}${arr.length + 1}`;
      arr.push({
        label: fallback,
        offset: arr.length > 0 ? arr[arr.length - 1].offset + 1000 : 0,
      });
      return { ...prev, [axis]: arr };
    });
  };

  const removeAxis = (axis: "x_axes" | "y_axes", index: number) => {
    setSettings((prev) => {
      const arr = prev[axis].slice();
      arr.splice(index, 1);
      return { ...prev, [axis]: arr };
    });
  };

  // 추가 축렬 그룹 관리
  const addGroup = () => {
    setSettings((prev) => {
      const next = (prev.extra_groups ?? []).slice();
      const color =
        GROUP_COLOR_PALETTE[next.length % GROUP_COLOR_PALETTE.length];
      next.push({
        name: `그룹 ${next.length + 1}`,
        angle_deg: 30,
        // 메인 X/Y 축렬의 origin 을 기본값으로 — (0,0) 으로 두면 모델 좌표가
        // 큰 양수일 때 회전축이 도면 영역에서 멀리 떨어져 그려진다.
        origin: prev.origin ?? [0, 0],
        axes: [],
        color,
      });
      return { ...prev, extra_groups: next };
    });
  };

  const updateGroup = <K extends keyof GridAxisGroup>(
    gi: number,
    key: K,
    value: GridAxisGroup[K],
  ) => {
    setSettings((prev) => {
      const next = (prev.extra_groups ?? []).slice();
      next[gi] = { ...next[gi], [key]: value };
      return { ...prev, extra_groups: next };
    });
  };

  const removeGroup = (gi: number) => {
    setSettings((prev) => {
      const next = (prev.extra_groups ?? []).slice();
      next.splice(gi, 1);
      return { ...prev, extra_groups: next };
    });
  };

  const addGroupAxis = (gi: number) => {
    setSettings((prev) => {
      const groups = (prev.extra_groups ?? []).slice();
      const axes = groups[gi].axes.slice();
      axes.push({
        label: `${groups[gi].name}-${axes.length + 1}`,
        offset: axes.length > 0 ? axes[axes.length - 1].offset + 1000 : 0,
      });
      groups[gi] = { ...groups[gi], axes };
      return { ...prev, extra_groups: groups };
    });
  };

  const updateGroupAxis = (
    gi: number,
    ai: number,
    key: keyof GridAxisItem,
    value: string | number,
  ) => {
    setSettings((prev) => {
      const groups = (prev.extra_groups ?? []).slice();
      const axes = groups[gi].axes.slice();
      axes[ai] = { ...axes[ai], [key]: value };
      groups[gi] = { ...groups[gi], axes };
      return { ...prev, extra_groups: groups };
    });
  };

  const removeGroupAxis = (gi: number, ai: number) => {
    setSettings((prev) => {
      const groups = (prev.extra_groups ?? []).slice();
      const axes = groups[gi].axes.slice();
      axes.splice(ai, 1);
      groups[gi] = { ...groups[gi], axes };
      return { ...prev, extra_groups: groups };
    });
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="프로젝트 설정"
        subtitle="축렬(Gridline) · 도면 기준 정보"
      />

      {error && <AlertBanner type="error" message={error} />}
      {notice && <AlertBanner type="success" message={notice} />}

      {loading ? (
        <SectionCard title="축렬 설정">
          <p className="text-sm text-gray-400">설정 로딩 중...</p>
        </SectionCard>
      ) : (
        <>
          {/* 전역 설정 + 자동 탐지 */}
          <SectionCard
            title="주축 · 자동 탐지"
            action={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={applyAutoDetect}
                  disabled={busy}
                  title="현재 MIDAS 모델의 보 방향으로 주축과 축렬을 자동 탐지"
                >
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                  자동 탐지 적용
                </Button>
                <Button size="sm" onClick={saveSettings} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  저장
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">주축 각도 (°)</label>
                <input
                  type="number"
                  step={0.1}
                  value={settings.angle_deg}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      angle_deg: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-[#8cbf2d] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  X 축렬 방향 각도. 0=수평, 양수=반시계.
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">라벨 형식</label>
                <select
                  value={settings.label_format}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      label_format: e.target.value as GridLabelFormat,
                    })
                  }
                  className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-[#8cbf2d] focus:outline-none"
                >
                  <option value="prefix">X1·X2 / Y1·Y2 (접두어)</option>
                  <option value="simple">1·2 / A·B (건축 관례)</option>
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  자동 탐지 시 기본 라벨에만 적용 — 개별 라벨은 직접 수정 가능.
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  자동 탐지 허용오차 (mm)
                </label>
                <input
                  type="number"
                  step={10}
                  value={posTol}
                  onChange={(e) => setPosTol(Math.max(1, Number(e.target.value) || 500))}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-[#8cbf2d] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  축렬 offset 클러스터링 tolerance (mm). 기본 500mm.
                </p>
              </div>
            </div>
            {settings.auto_detected && (
              <p className="text-[11px] text-[#8cbf2d] bg-[#669900]/10 border border-[#669900]/40 rounded px-3 py-1.5">
                최근 자동 탐지로 채워짐 — 라벨/offset 수동 조정 후 저장하세요.
              </p>
            )}
          </SectionCard>

          {/* X 축렬 */}
          <AxisTable
            title="X 축렬 (주축1 방향)"
            axes={settings.x_axes}
            onUpdate={(i, k, v) => updateAxis("x_axes", i, k, v)}
            onAdd={() => addAxis("x_axes")}
            onRemove={(i) => removeAxis("x_axes", i)}
          />
          {/* Y 축렬 */}
          <AxisTable
            title="Y 축렬 (주축2 방향, 90°)"
            axes={settings.y_axes}
            onUpdate={(i, k, v) => updateAxis("y_axes", i, k, v)}
            onAdd={() => addAxis("y_axes")}
            onRemove={(i) => removeAxis("y_axes", i)}
          />

          {/* 추가 회전 축렬 그룹 */}
          <SectionCard
            title={`추가 축렬 그룹 · ${settings.extra_groups?.length ?? 0}개`}
            action={
              <Button size="sm" variant="outline" onClick={addGroup}>
                <Plus size={14} /> 그룹 추가
              </Button>
            }
          >
            {(settings.extra_groups ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">
                X/Y 외에 다른 회전각의 축렬이 필요하면 「그룹 추가」를 누르세요.
                사선 그리드, 특정 동의 별도 축렬 등.
              </p>
            ) : (
              <div className="space-y-4">
                {settings.extra_groups.map((g, gi) => (
                  <div
                    key={gi}
                    className="rounded-lg border border-gray-700 bg-gray-800/60 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-block w-4 h-4 rounded-full border-2 border-white"
                        style={{ background: g.color }}
                        title="축렬 색상"
                      />
                      <input
                        type="text"
                        value={g.name}
                        onChange={(e) => updateGroup(gi, "name", e.target.value)}
                        placeholder="그룹 이름"
                        className="flex-1 min-w-[140px] rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:border-[#8cbf2d] focus:outline-none"
                      />
                      <label className="text-xs text-gray-400 whitespace-nowrap">
                        각도(°)
                      </label>
                      <input
                        type="number"
                        step={0.1}
                        value={g.angle_deg}
                        onChange={(e) =>
                          updateGroup(gi, "angle_deg", Number(e.target.value) || 0)
                        }
                        className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-right text-sm font-mono text-white focus:border-[#8cbf2d] focus:outline-none"
                      />
                      <input
                        type="color"
                        value={g.color}
                        onChange={(e) => updateGroup(gi, "color", e.target.value)}
                        className="h-7 w-10 cursor-pointer rounded border border-gray-600 bg-gray-700"
                        title="색상"
                      />
                      <button
                        type="button"
                        onClick={() => removeGroup(gi)}
                        className="rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40 transition"
                        title="그룹 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {/* 기준점(origin) 입력 — 첫 축렬(offset=0)이 위치할 world 좌표 (mm) */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 whitespace-nowrap">기준점 (mm):</span>
                      <span className="text-gray-500">X</span>
                      <input
                        type="number"
                        step={100}
                        value={g.origin[0]}
                        onChange={(e) =>
                          updateGroup(gi, "origin", [
                            Number(e.target.value) || 0,
                            g.origin[1],
                          ])
                        }
                        className="w-28 rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-right font-mono text-white focus:border-[#8cbf2d] focus:outline-none"
                      />
                      <span className="text-gray-500">Y</span>
                      <input
                        type="number"
                        step={100}
                        value={g.origin[1]}
                        onChange={(e) =>
                          updateGroup(gi, "origin", [
                            g.origin[0],
                            Number(e.target.value) || 0,
                          ])
                        }
                        className="w-28 rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-right font-mono text-white focus:border-[#8cbf2d] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateGroup(gi, "origin", settings.origin)
                        }
                        className="rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-gray-200 hover:bg-gray-600 transition whitespace-nowrap"
                        title="메인 X/Y 축렬의 origin 으로 복원"
                      >
                        메인 origin 사용
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded border border-gray-700">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-700/60 text-[10px] uppercase text-gray-300">
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold w-10">
                              #
                            </th>
                            <th className="px-2 py-1 text-left font-semibold">라벨</th>
                            <th className="px-2 py-1 text-right font-semibold">
                              Offset (mm, 음수 가능)
                            </th>
                            <th className="px-2 py-1 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {g.axes.map((a, ai) => (
                            <tr key={ai}>
                              <td className="px-2 py-1 text-gray-500">{ai + 1}</td>
                              <td className="px-2 py-1">
                                <input
                                  type="text"
                                  value={a.label}
                                  onChange={(e) =>
                                    updateGroupAxis(gi, ai, "label", e.target.value)
                                  }
                                  className="w-28 rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white focus:border-[#8cbf2d] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <input
                                  type="number"
                                  step={1}
                                  value={a.offset}
                                  onChange={(e) =>
                                    updateGroupAxis(
                                      gi,
                                      ai,
                                      "offset",
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="w-28 rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-right text-sm font-mono text-white focus:border-[#8cbf2d] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeGroupAxis(gi, ai)}
                                  className="text-gray-500 hover:text-red-400 transition"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {g.axes.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-3 py-3 text-center text-xs text-gray-500"
                              >
                                축렬 없음
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addGroupAxis(gi)}
                    >
                      <Plus size={13} /> 축렬 추가
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function AxisTable({
  title,
  axes,
  onUpdate,
  onAdd,
  onRemove,
}: {
  title: string;
  axes: GridAxisItem[];
  onUpdate: (index: number, key: keyof GridAxisItem, value: string | number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <SectionCard
      title={`${title} · ${axes.length}개`}
      action={
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus size={14} /> 축렬 추가
        </Button>
      }
    >
      {axes.length === 0 ? (
        <p className="text-sm text-gray-500">
          축렬이 없습니다. 「자동 탐지 적용」 또는 「축렬 추가」로 시작하세요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-700 text-[11px] uppercase text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-16">#</th>
                <th className="px-3 py-2 text-left font-semibold">라벨 (버블 안)</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Offset (mm, 음수 가능)
                </th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {axes.map((a, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-gray-800" : "bg-gray-800/60"}
                >
                  <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={a.label}
                      onChange={(e) => onUpdate(i, "label", e.target.value)}
                      className="w-32 rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-sm text-white focus:border-[#8cbf2d] focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      step={1}
                      value={a.offset}
                      onChange={(e) =>
                        onUpdate(i, "offset", Number(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-right text-sm font-mono text-white focus:border-[#8cbf2d] focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className="text-gray-500 hover:text-red-400 transition"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
