"use client";

import { useState, useEffect, useCallback } from "react";
import { BACKEND_URL } from "@/lib/types";
import { RefreshCw, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface AutoData {
  project_name: string;
  address: string;
  importance: string;
  floor_area: number;
  actual_height: number;
  above_floors: number;
  below_floors: number;
  total_height: number;
  struct_type_x: string;
  struct_type_y: string;
  sfrs_x: string;
  sfrs_y: string;
  spec_code: string;
  zone_factor: number;
  sc: number;
  sc_label: string;
  ie: number;
  r_x: number;
  r_y: number;
  omega_x: number;
  omega_y: number;
  cd_x: number;
  cd_y: number;
  sds: number;
  sd1: number;
  total_weight: number;
  vsx: number;
  vsy: number;
  csx: number;
  csy: number;
  tax: number;
  tay: number;
  seismic_category: string;
  form_type: string;
  allowable_drift: string;
  design_code: string;
  mode1_period: number;
  mode1_mass_ratio: number;
  mode2_period: number;
  mode2_mass_ratio: number;
  mode3_period: number;
  mode3_mass_ratio: number;
}

interface ManualData {
  usage: string;
  design_code: string;
  struct_plan: string;
  ground_water_level: string;
  foundation_type: string;
  design_bearing: string;
  pile_capacity: string;
  analysis_method: string;
  seismic_category_override: string;
  sfrs_x_detail: string;
  sfrs_y_detail: string;
  allowable_drift: string;
  max_drift_x: string;
  max_drift_y: string;
  has_piloti: string;
  has_out_of_plane: string;
  has_lateral_discontinuity: string;
  has_vertical_discontinuity: string;
  arch_non_structural: string;
  mech_non_structural: string;
  special_notes: string;
  author_name: string;
  designer_name: string;
  author_address: string;
  designer_address: string;
  author_phone: string;
  designer_phone: string;
  submit_date: string;
  basic_wind_speed: string;
  wind_exposure: string;
  gust_factor: string;
  wind_importance: string;
  max_story_disp_x: string;
  max_story_disp_y: string;
  max_story_drift_x: string;
  max_story_drift_y: string;
  mode1_period: string;
  mode1_mass_ratio: string;
  mode2_period: string;
  mode2_mass_ratio: string;
  mode3_period: string;
  mode3_mass_ratio: string;
}

const defaultManual: ManualData = {
  usage: "",
  design_code: "",
  struct_plan: "",
  ground_water_level: "",
  foundation_type: "",
  design_bearing: "",
  pile_capacity: "",
  analysis_method: "동적해석법",
  seismic_category_override: "",
  sfrs_x_detail: "",
  sfrs_y_detail: "",
  allowable_drift: "0.015hs",
  max_drift_x: "",
  max_drift_y: "",
  has_piloti: "무",
  has_out_of_plane: "무",
  has_lateral_discontinuity: "무",
  has_vertical_discontinuity: "무",
  arch_non_structural: "",
  mech_non_structural: "",
  special_notes: "",
  author_name: "",
  designer_name: "",
  author_address: "",
  designer_address: "",
  author_phone: "",
  designer_phone: "",
  submit_date: "",
  basic_wind_speed: "",
  wind_exposure: "",
  gust_factor: "",
  wind_importance: "",
  max_story_disp_x: "",
  max_story_disp_y: "",
  max_story_drift_x: "",
  max_story_drift_y: "",
  mode1_period: "",
  mode1_mass_ratio: "",
  mode2_period: "",
  mode2_mass_ratio: "",
  mode3_period: "",
  mode3_mass_ratio: "",
};

function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex gap-2">
        {["유", "무"].map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1 text-xs rounded-md border transition ${
              value === opt
                ? "bg-[#669900] text-white border-[#669900]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SeismicCertPage() {
  const [autoData, setAutoData] = useState<AutoData | null>(null);
  const [manual, setManual] = useState<ManualData>(defaultManual);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const fetchAuto = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/seismic-cert/auto`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AutoData = await res.json();
      setAutoData(data);
      // 자동 데이터로 수동입력 기본값 설정
      setManual((prev) => ({
        ...prev,
        allowable_drift: data.allowable_drift || prev.allowable_drift,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuto(); }, [fetchAuto]);

  const updateManual = (key: keyof ManualData, value: string) => {
    setManual((prev) => ({ ...prev, [key]: value }));
  };

  const handleDownload = async () => {
    if (!autoData) return;
    setDownloading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/seismic-cert/hwpx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_data: autoData, manual_data: manual }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `구조안전확인서_${autoData.form_type}.hwpx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  const is6Floor = autoData?.form_type === "6층이상";

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내진설계 확인서</h1>
          <p className="text-gray-500 mt-1">구조안전 및 내진설계 확인서 자동 생성</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAuto}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            onClick={handleDownload}
            disabled={!autoData || downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#669900] text-white rounded-lg hover:bg-[#5a8700] disabled:opacity-50 transition"
          >
            <Download size={14} className={downloading ? "animate-bounce" : ""} />
            {downloading ? "생성 중..." : "hwpx 다운로드"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* 양식 유형 표시 */}
      {autoData && (
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-[#669900]" />
          <span className="text-sm font-medium text-gray-700">
            {is6Floor ? "별지 제1호서식 (6층 이상)" : "별지 제2호서식 (5층 이하)"}
          </span>
          <span className="text-xs text-gray-400">
            지상 {autoData.above_floors}층 {autoData.below_floors > 0 ? `/ 지하 ${autoData.below_floors}층` : ""}
          </span>
        </div>
      )}

      {autoData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 좌측: 자동 수집 데이터 */}
          <div className="space-y-4">
            <SectionCard title="프로젝트 정보 (자동)">
              <Field label="공사명" value={autoData.project_name} />
              <Field label="대지위치" value={autoData.address} />
              <Field label="중요도" value={autoData.importance} />
              <Field label="연면적" value={autoData.floor_area ? `${autoData.floor_area} m²` : ""} />
              <Field label="층수" value={`지상 ${autoData.above_floors}층${autoData.below_floors > 0 ? ` / 지하 ${autoData.below_floors}층` : ""}`} />
              <Field label="높이" value={autoData.actual_height ? `${autoData.actual_height} m` : `${autoData.total_height.toFixed(1)} m`} />
            </SectionCard>

            <SectionCard title="내진설계 파라미터 (자동)">
              <Field label="설계기준" value={autoData.spec_code} />
              <Field label="지역계수" value={autoData.zone_factor} />
              <Field label="지반분류" value={autoData.sc_label} />
              <Field label="중요도계수 IE" value={autoData.ie} />
              <Field label="Sds" value={autoData.sds} />
              <Field label="Sd1" value={autoData.sd1} />
              <Field label="반응수정계수 R" value={`X: ${autoData.r_x} / Y: ${autoData.r_y}`} />
              <Field label="초과강도계수 Ω₀" value={`X: ${autoData.omega_x} / Y: ${autoData.omega_y}`} />
              <Field label="변위증폭계수 Cd" value={`X: ${autoData.cd_x} / Y: ${autoData.cd_y}`} />
              <Field label="내진설계범주" value={autoData.seismic_category} />
              <Field label="허용층간변위" value={autoData.allowable_drift} />
            </SectionCard>

            <SectionCard title="해석 결과 (자동)">
              <Field label="건물유효중량 W" value={autoData.total_weight ? `${autoData.total_weight.toFixed(1)} kN` : ""} />
              <Field label="밑면전단력 Vsx" value={autoData.vsx ? `${autoData.vsx.toFixed(1)} kN` : ""} />
              <Field label="밑면전단력 Vsy" value={autoData.vsy ? `${autoData.vsy.toFixed(1)} kN` : ""} />
              <Field label="지진응답계수 Csx" value={autoData.csx ? autoData.csx.toFixed(4) : ""} />
              <Field label="지진응답계수 Csy" value={autoData.csy ? autoData.csy.toFixed(4) : ""} />
              <Field label="고유주기 Tax" value={autoData.tax ? `${autoData.tax.toFixed(4)} sec` : ""} />
              <Field label="고유주기 Tay" value={autoData.tay ? `${autoData.tay.toFixed(4)} sec` : ""} />
              <Field label="SFRS X" value={autoData.sfrs_x} />
              <Field label="SFRS Y" value={autoData.sfrs_y} />
            </SectionCard>

            {is6Floor && autoData.mode1_period > 0 && (
              <SectionCard title="모드 해석 (자동)">
                <Field label="1차 모드" value={autoData.mode1_period ? `${autoData.mode1_period.toFixed(4)} sec (${autoData.mode1_mass_ratio.toFixed(1)}%)` : ""} />
                <Field label="2차 모드" value={autoData.mode2_period ? `${autoData.mode2_period.toFixed(4)} sec (${autoData.mode2_mass_ratio.toFixed(1)}%)` : ""} />
                <Field label="3차 모드" value={autoData.mode3_period ? `${autoData.mode3_period.toFixed(4)} sec (${autoData.mode3_mass_ratio.toFixed(1)}%)` : ""} />
              </SectionCard>
            )}
          </div>

          {/* 우측: 수동 입력 */}
          <div className="space-y-4">
            <SectionCard title="기본 정보 (수동입력)">
              <InputField label="용도" value={manual.usage} onChange={(v) => updateManual("usage", v)} placeholder="예: 업무시설" />
              <InputField label="사용설계기준" value={manual.design_code} onChange={(v) => updateManual("design_code", v)} placeholder={autoData.design_code} />
              <InputField label="구조계획" value={manual.struct_plan} onChange={(v) => updateManual("struct_plan", v)} placeholder={autoData.struct_type_x || "철근콘크리트 구조"} />
            </SectionCard>

            <SectionCard title="지반 및 기초 (수동입력)">
              <InputField label="지하수위" value={manual.ground_water_level} onChange={(v) => updateManual("ground_water_level", v)} placeholder="GL -3.0m" />
              <InputField label="기초형식" value={manual.foundation_type} onChange={(v) => updateManual("foundation_type", v)} placeholder="매트기초" />
              <InputField label="설계지내력" value={manual.design_bearing} onChange={(v) => updateManual("design_bearing", v)} placeholder="20 (t/m²)" />
              <InputField label="파일기초" value={manual.pile_capacity} onChange={(v) => updateManual("pile_capacity", v)} placeholder="(ton)" />
            </SectionCard>

            <SectionCard title="내진설계 (수동입력)">
              <SelectField
                label="해석법"
                value={manual.analysis_method}
                onChange={(v) => updateManual("analysis_method", v)}
                options={[
                  { value: "동적해석법", label: "동적해석법" },
                  { value: "등가정적해석법", label: "등가정적해석법" },
                  { value: "등가정적해석법, 동적해석법", label: "등가정적+동적" },
                ]}
              />
              <InputField label="범주 수정" value={manual.seismic_category_override} onChange={(v) => updateManual("seismic_category_override", v)} placeholder={`자동: ${autoData.seismic_category}`} />
              <InputField label="SFRS X 상세" value={manual.sfrs_x_detail} onChange={(v) => updateManual("sfrs_x_detail", v)} placeholder={autoData.sfrs_x} />
              <InputField label="SFRS Y 상세" value={manual.sfrs_y_detail} onChange={(v) => updateManual("sfrs_y_detail", v)} placeholder={autoData.sfrs_y} />
              <SelectField
                label="허용층간변위"
                value={manual.allowable_drift}
                onChange={(v) => updateManual("allowable_drift", v)}
                options={[
                  { value: "0.010hs", label: "0.010 hs" },
                  { value: "0.015hs", label: "0.015 hs" },
                  { value: "0.020hs", label: "0.020 hs" },
                ]}
              />
              <InputField label="최대층간변위 X" value={manual.max_drift_x} onChange={(v) => updateManual("max_drift_x", v)} />
              <InputField label="최대층간변위 Y" value={manual.max_drift_y} onChange={(v) => updateManual("max_drift_y", v)} />
            </SectionCard>

            <SectionCard title="구조요소 검토 (수동입력)">
              <ToggleField label="피로티" value={manual.has_piloti} onChange={(v) => updateManual("has_piloti", v)} />
              <ToggleField label="면외어긋남" value={manual.has_out_of_plane} onChange={(v) => updateManual("has_out_of_plane", v)} />
              <ToggleField label="횡력저항 불연속" value={manual.has_lateral_discontinuity} onChange={(v) => updateManual("has_lateral_discontinuity", v)} />
              <ToggleField label="수직시스템 불연속" value={manual.has_vertical_discontinuity} onChange={(v) => updateManual("has_vertical_discontinuity", v)} />
            </SectionCard>

            <SectionCard title="비구조요소 / 특이사항" defaultOpen={false}>
              <InputField label="건축비구조요소" value={manual.arch_non_structural} onChange={(v) => updateManual("arch_non_structural", v)} />
              <InputField label="기계·전기" value={manual.mech_non_structural} onChange={(v) => updateManual("mech_non_structural", v)} />
              <div className="flex gap-2">
                <label className="text-xs text-gray-500 w-28 flex-shrink-0">특이사항</label>
                <textarea
                  value={manual.special_notes}
                  onChange={(e) => updateManual("special_notes", e.target.value)}
                  rows={3}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#669900]/40 focus:border-[#669900] outline-none resize-none"
                />
              </div>
            </SectionCard>

            <SectionCard title="작성자 정보" defaultOpen={false}>
              <InputField label="작성자(구조기술사)" value={manual.author_name} onChange={(v) => updateManual("author_name", v)} />
              <InputField label="설계자(건축사)" value={manual.designer_name} onChange={(v) => updateManual("designer_name", v)} />
              <InputField label="작성자 주소" value={manual.author_address} onChange={(v) => updateManual("author_address", v)} />
              <InputField label="설계자 주소" value={manual.designer_address} onChange={(v) => updateManual("designer_address", v)} />
              <InputField label="작성자 연락처" value={manual.author_phone} onChange={(v) => updateManual("author_phone", v)} />
              <InputField label="설계자 연락처" value={manual.designer_phone} onChange={(v) => updateManual("designer_phone", v)} />
              <InputField label="제출일" value={manual.submit_date} onChange={(v) => updateManual("submit_date", v)} placeholder="2026. 4. 7." />
            </SectionCard>

            {/* 6층 이상 전용 섹션 */}
            {is6Floor && (
              <>
                <SectionCard title="풍하중 (6층 이상 전용)" defaultOpen={false}>
                  <InputField label="기본풍속 V0" value={manual.basic_wind_speed} onChange={(v) => updateManual("basic_wind_speed", v)} placeholder="m/sec" />
                  <InputField label="노풍도" value={manual.wind_exposure} onChange={(v) => updateManual("wind_exposure", v)} placeholder="A, B, C, D" />
                  <InputField label="가스트계수 Gf" value={manual.gust_factor} onChange={(v) => updateManual("gust_factor", v)} />
                  <InputField label="풍하중 중요도계수" value={manual.wind_importance} onChange={(v) => updateManual("wind_importance", v)} />
                  <InputField label="최대변위 X" value={manual.max_story_disp_x} onChange={(v) => updateManual("max_story_disp_x", v)} />
                  <InputField label="최대변위 Y" value={manual.max_story_disp_y} onChange={(v) => updateManual("max_story_disp_y", v)} />
                  <InputField label="최대층간변위 X" value={manual.max_story_drift_x} onChange={(v) => updateManual("max_story_drift_x", v)} />
                  <InputField label="최대층간변위 Y" value={manual.max_story_drift_y} onChange={(v) => updateManual("max_story_drift_y", v)} />
                </SectionCard>

                <SectionCard title="모드 해석 수정 (자동 수집됨)" defaultOpen={false}>
                  <InputField label="1차 모드 주기" value={manual.mode1_period} onChange={(v) => updateManual("mode1_period", v)} placeholder={autoData.mode1_period ? `${autoData.mode1_period.toFixed(4)} (자동)` : "sec"} />
                  <InputField label="1차 질량참여율" value={manual.mode1_mass_ratio} onChange={(v) => updateManual("mode1_mass_ratio", v)} placeholder={autoData.mode1_mass_ratio ? `${autoData.mode1_mass_ratio.toFixed(1)} (자동)` : "%"} />
                  <InputField label="2차 모드 주기" value={manual.mode2_period} onChange={(v) => updateManual("mode2_period", v)} placeholder={autoData.mode2_period ? `${autoData.mode2_period.toFixed(4)} (자동)` : "sec"} />
                  <InputField label="2차 질량참여율" value={manual.mode2_mass_ratio} onChange={(v) => updateManual("mode2_mass_ratio", v)} placeholder={autoData.mode2_mass_ratio ? `${autoData.mode2_mass_ratio.toFixed(1)} (자동)` : "%"} />
                  <InputField label="3차 모드 주기" value={manual.mode3_period} onChange={(v) => updateManual("mode3_period", v)} placeholder={autoData.mode3_period ? `${autoData.mode3_period.toFixed(4)} (자동)` : "sec"} />
                  <InputField label="3차 질량참여율" value={manual.mode3_mass_ratio} onChange={(v) => updateManual("mode3_mass_ratio", v)} placeholder={autoData.mode3_mass_ratio ? `${autoData.mode3_mass_ratio.toFixed(1)} (자동)` : "%"} />
                </SectionCard>
              </>
            )}
          </div>
        </div>
      )}

      {!autoData && !loading && !error && (
        <div className="text-center py-16 text-gray-400">MIDAS GEN NX에 연결 후 데이터를 조회합니다</div>
      )}
    </div>
  );
}
