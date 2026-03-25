"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader2, MapPin, Search, Settings2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

let _gmapsKey = "";
async function getGmapsKey(): Promise<string> {
  if (_gmapsKey) return _gmapsKey;
  try {
    const r = await fetch(`${BACKEND_URL}/api/gmaps-key`);
    const d = await r.json();
    _gmapsKey = d.key ?? "";
  } catch { /* ignore */ }
  return _gmapsKey;
}

// ── 타입 ──────────────────────────────────────────────────────────────
interface ProjectData {
  PROJECT: string;
  CLIENT: string;
  ADDRESS: string;
  COMMENT: string;
}

type TestResult = { connected: boolean; message: string } | null;

interface StoryRow {
  id: string;
  STORY_NAME: string;
  STORY_LEVEL: number;
  HEIGHT: number;          // 계산값: 현재층 - 아래층 레벨
  bFLOOR_DIAPHRAGM: boolean;
}

// ── 층 데이터에서 자동 계산 ─────────────────────────────────────────────
function calcFromStory(rows: StoryRow[]) {
  let aboveFloors = 0;
  let belowFloors = 0;
  let maxLevel = 0;

  for (const r of rows) {
    const name = r.STORY_NAME.trim();
    // 지상층: {숫자}F 패턴
    const aboveMatch = name.match(/^(\d+)F$/i);
    if (aboveMatch) aboveFloors = Math.max(aboveFloors, parseInt(aboveMatch[1]));
    // 지하층: B{숫자} 또는 B{숫자}F 패턴
    const belowMatch = name.match(/^B(\d+)F?$/i);
    if (belowMatch) belowFloors = Math.max(belowFloors, parseInt(belowMatch[1]));
    // 해석높이: 최대 STORY_LEVEL
    if (r.STORY_LEVEL > maxLevel) maxLevel = r.STORY_LEVEL;
  }

  return { aboveFloors, belowFloors, analysisHeight: maxLevel };
}

// COMMENT JSON 파싱/생성 유틸
function parseComment(comment: string): { projectCode: string; floorArea: string; actualHeight: string } {
  try {
    const obj = JSON.parse(comment);
    return {
      projectCode: obj["PROJECT_CODE"] ?? "",
      floorArea: obj["FLOOR_AREA"] ?? "",
      actualHeight: obj["ACTUAL_HEIGHT"] ?? "",
    };
  } catch {
    // 기존 문자열 COMMENT → projectCode로 사용
    return { projectCode: comment, floorArea: "", actualHeight: "" };
  }
}

function buildComment(projectCode: string, floorArea: string, actualHeight: string): string {
  return JSON.stringify({ PROJECT_CODE: projectCode, FLOOR_AREA: floorArea, ACTUAL_HEIGHT: actualHeight });
}

// ── 프로젝트 정보 섹션 ─────────────────────────────────────────────────
function ProjectSection({ onAddressChange, storyRows }: { onAddressChange: (addr: string) => void; storyRows: StoryRow[] }) {
  const [data, setData] = useState<ProjectData>({ PROJECT: "", CLIENT: "", ADDRESS: "", COMMENT: "" });
  const [projectCode, setProjectCode] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [actualHeight, setActualHeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { aboveFloors, belowFloors, analysisHeight } = calcFromStory(storyRows);

  const fetch_ = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/project`);
      if (!r.ok) throw new Error(`서버 오류: ${r.status}`);
      const d = await r.json();
      const newData = { PROJECT: d.PROJECT ?? "", CLIENT: d.CLIENT ?? "", ADDRESS: d.ADDRESS ?? "", COMMENT: d.COMMENT ?? "" };
      setData(newData);
      if (newData.ADDRESS) onAddressChange(newData.ADDRESS);
      const parsed = parseComment(newData.COMMENT);
      setProjectCode(parsed.projectCode);
      setFloorArea(parsed.floorArea);
      setActualHeight(parsed.actualHeight);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const saveData = {
        ...data,
        COMMENT: buildComment(projectCode, floorArea, actualHeight),
      };
      const res = await fetch(`${BACKEND_URL}/api/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveData),
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof ProjectData; label: string }[] = [
    { key: "PROJECT", label: "프로젝트명" },
    { key: "CLIENT",  label: "발주처" },
    { key: "ADDRESS", label: "주소" },
  ];

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">프로젝트 정보</h2>
        <button type="button" onClick={fetch_} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* Project CODE (별도 관리) */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Project CODE</label>
        <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <input
              value={data[key]}
              onChange={(e) => {
                const val = e.target.value;
                setData((p) => ({ ...p, [key]: val }));
                if (key === "ADDRESS") onAddressChange(val);
              }}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">연면적 (m²)</label>
          <input value={floorArea} onChange={(e) => setFloorArea(e.target.value)}
            placeholder="수동 입력"
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 층수/높이 정보 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">지상층수</label>
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">
            {aboveFloors > 0 ? `${aboveFloors}F` : "-"}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">지하층수</label>
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">
            {belowFloors > 0 ? `B${belowFloors}` : "-"}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">해석높이 (m)</label>
          <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-1.5 text-sm text-gray-300">
            {analysisHeight > 0 ? analysisHeight.toFixed(3) : "-"}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">실제높이 (m)</label>
          <input value={actualHeight} onChange={(e) => setActualHeight(e.target.value)}
            placeholder="수동 입력"
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />업데이트됨</span>}
        <button type="submit" disabled={saving}
          className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "업데이트 중..." : "MIDAS에 업데이트"}
        </button>
      </div>
    </form>
  );
}

// ── 지도 섹션 (풍속 등치선 오버레이) ────────────────────────────────────
const OVERLAY_BOUNDS = { north: 38.7502, south: 32.6992, west: 124.0089, east: 131.6824 };
const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1a2030" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b949e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1117" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#30363d" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#58a6ff" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#6e9ac7" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#21262d" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2a3040" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a4150" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1a2e" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a5f8a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#161b22" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

let _loadPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (typeof google !== "undefined" && google.maps?.Map) return Promise.resolve();
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    // 이전 HMR로 남은 스크립트가 있으면 재사용
    if (document.getElementById("gmaps-script")) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (typeof google !== "undefined" && google.maps?.Map) { clearInterval(check); resolve(); }
        }, 100);
      });
      return;
    }
    const key = await getGmapsKey();
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.id = "gmaps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=ko&region=KR&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // loading=async 모드에서는 script onload 후에도 google.maps.Map이 아직 없을 수 있음
        const wait = setInterval(() => {
          if (typeof google !== "undefined" && google.maps && google.maps.Map) {
            clearInterval(wait);
            resolve();
          }
        }, 50);
      };
      script.onerror = () => { _loadPromise = null; reject(new Error("Google Maps 로드 실패")); };
      document.head.appendChild(script);
    });
  })();
  return _loadPromise;
}

declare const google: any;   // eslint-disable-line @typescript-eslint/no-explicit-any

function MapSection({ address }: { address: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const geocoder = useRef<any>(null);
  const markerInner = useRef<any>(null);
  const markerOuter = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const [opacity, setOpacity] = useState(0.95);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ addr: string; lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Google Maps 초기화
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 35.8, lng: 127.8 },
        zoom: 7,
        minZoom: 7,
        maxZoom: 7,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        gestureHandling: "none",
        keyboardShortcuts: false,
        styles: DARK_MAP_STYLES,
      });
      mapInstance.current = map;
      geocoder.current = new google.maps.Geocoder();

      // 등치선 오버레이
      class ContourOverlay extends google.maps.OverlayView {
        _opacity = 0.95;
        div: HTMLDivElement | null = null;
        bg: HTMLDivElement | null = null;
        img = new Image();
        constructor() { super(); this.img.src = "/windloadmap_warped.png"; }
        onAdd() {
          this.div = document.createElement("div");
          this.div.style.cssText = "position:absolute;";
          this.bg = document.createElement("div");
          this.bg.style.cssText = `width:100%;height:100%;position:absolute;background:white;opacity:${this._opacity};`;
          this.img.style.cssText = `width:100%;height:100%;position:absolute;opacity:${this._opacity};`;
          this.div.appendChild(this.bg);
          this.div.appendChild(this.img);
          this.getPanes().overlayLayer.appendChild(this.div);
        }
        draw() {
          const proj = this.getProjection();
          if (!proj || !this.div) return;
          const sw = proj.fromLatLngToDivPixel(new google.maps.LatLng(OVERLAY_BOUNDS.south, OVERLAY_BOUNDS.west));
          const ne = proj.fromLatLngToDivPixel(new google.maps.LatLng(OVERLAY_BOUNDS.north, OVERLAY_BOUNDS.east));
          this.div.style.left = sw.x + "px";
          this.div.style.top = ne.y + "px";
          this.div.style.width = (ne.x - sw.x) + "px";
          this.div.style.height = (sw.y - ne.y) + "px";
        }
        onRemove() { this.div?.remove(); }
        setOpacity(v: number) {
          this._opacity = v;
          if (this.img) this.img.style.opacity = String(v);
          if (this.bg) this.bg.style.opacity = String(v);
        }
      }

      const overlay = new ContourOverlay();
      overlay.setMap(map);
      overlayRef.current = overlay;
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // 오버레이 투명도
  useEffect(() => { overlayRef.current?.setOpacity(opacity); }, [opacity]);

  // 주소 검색 함수
  const searchAddress = useCallback((addr: string) => {
    if (!addr.trim() || !geocoder.current || !mapInstance.current) return;
    setSearching(true);
    setError(null);

    geocoder.current.geocode({ address: addr, region: "KR" }, (results: any[], status: string) => {
      setSearching(false);
      if (status !== "OK" || !results?.length) {
        setError("주소를 찾을 수 없습니다.");
        setResult(null);
        return;
      }

      const loc = results[0].geometry.location;
      const lat = loc.lat();
      const lng = loc.lng();
      const fullAddr = results[0].formatted_address;

      // 기존 마커 제거
      markerInner.current?.setMap(null);
      markerOuter.current?.setMap(null);

      // 이중 원 마커
      markerOuter.current = new google.maps.Circle({
        center: { lat, lng }, radius: 12000,
        fillColor: "transparent", fillOpacity: 0,
        strokeColor: "#ef4444", strokeOpacity: 0.9, strokeWeight: 2.5,
        map: mapInstance.current, zIndex: 10,
      });
      markerInner.current = new google.maps.Circle({
        center: { lat, lng }, radius: 5000,
        fillColor: "#ef4444", fillOpacity: 0.85,
        strokeColor: "#ffffff", strokeOpacity: 0.9, strokeWeight: 1.5,
        map: mapInstance.current, zIndex: 11,
      });

      setResult({ addr: fullAddr, lat, lng });
    });
  }, []);

  // 주소 변경 시 자동 검색 (디바운스 800ms)
  const lastSearched = useRef("");
  useEffect(() => {
    if (!ready || !address.trim() || address === lastSearched.current) return;
    const timer = setTimeout(() => {
      lastSearched.current = address;
      searchAddress(address);
    }, 800);
    return () => clearTimeout(timer);
  }, [address, ready, searchAddress]);

  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <MapPin size={16} />
            MAPS
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5 ml-6">해당 지도는 실제 지도와 정확히 일치하지 않으므로 정밀한 확인 필요</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>등치선</span>
            <input type="range" min="0" max="1" step="0.05" value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-16 accent-blue-500 cursor-pointer" />
            <span className="font-mono text-blue-400 w-8">{Math.round(opacity * 100)}%</span>
          </div>
          <button onClick={() => searchAddress(address)} disabled={searching || !ready || !address.trim()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
            <Search size={13} className={searching ? "animate-spin" : ""} />
            위치 검색
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2 text-xs text-gray-300 flex items-center gap-4">
          <span className="text-white">{result.addr}</span>
          <span className="text-gray-500">|</span>
          <span>위도 {result.lat.toFixed(5)}</span>
          <span>경도 {result.lng.toFixed(5)}</span>
        </div>
      )}

      <div ref={mapRef} className="w-full rounded-lg overflow-hidden flex-1" style={{ minHeight: 610 }} />
    </div>
  );
}

// ── 자중입력 확인 섹션 ──────────────────────────────────────────────────
interface SelfWeightRow {
  id: string;
  LCNAME: string;
  GROUP_NAME: string;
  FV: number[];
  factor: number | null;
  valid: boolean;
}

interface StructureMass {
  MASS_LABEL: string;
  SMASS_LABEL: string;
}

interface LoadToMassData {
  DIR_X: boolean;
  DIR_Y: boolean;
  DIR_Z: boolean;
  bNODAL: boolean;
  bBEAM: boolean;
  bFLOOR: boolean;
  bPRES: boolean;
  vLC: { LCNAME: string; FACTOR: number }[];
}

function SelfWeightSection() {
  const [rows, setRows] = useState<SelfWeightRow[]>([]);
  const [massDat, setMassDat] = useState<StructureMass | null>(null);
  const [ltomDat, setLtomDat] = useState<LoadToMassData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [swRes, massRes, ltomRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/selfweight`),
        fetch(`${BACKEND_URL}/api/structure-mass`),
        fetch(`${BACKEND_URL}/api/load-to-mass`),
      ]);
      if (!swRes.ok) throw new Error(`서버 오류: ${swRes.status}`);
      setRows(await swRes.json());
      if (massRes.ok) setMassDat(await massRes.json());
      if (ltomRes.ok) setLtomDat(await ltomRes.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Settings2 size={16} />
          SETTING
        </h2>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Structure Mass */}
      {massDat && (
        <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-blue-400">Structure Mass</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-gray-800/60 px-3 py-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Mass Type</span>
              <div className="text-white font-medium mt-0.5">{massDat.MASS_LABEL}</div>
            </div>
            <div className="rounded-md bg-gray-800/60 px-3 py-2">
              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Convert Mass</span>
              <div className="text-white font-medium mt-0.5">{massDat.SMASS_LABEL}</div>
            </div>
          </div>
        </div>
      )}

      {/* 자중입력 확인 */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">자중입력 확인</h3>

        {rows.length === 0 && !loading && !error && (
          <p className="text-xs text-gray-500">데이터 없음</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="pb-2 pr-4 font-medium text-gray-400">Load Case</th>
                  <th className="pb-2 pr-4 font-medium text-gray-400 text-right">Factor</th>
                  <th className="pb-2 font-medium text-gray-400 text-center w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-700/30 hover:bg-gray-600/20">
                    <td className="py-1.5 pr-4 text-white">{r.LCNAME}</td>
                    <td className="py-1.5 pr-4 text-gray-300 text-right">
                      {r.factor !== null ? r.factor : "-"}
                    </td>
                    <td className="py-1.5 text-center text-lg">
                      {r.valid
                        ? <span className="text-green-400">●</span>
                        : <span className="text-red-400">●</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loads to Masses */}
      <div className="rounded-lg bg-gray-700/40 border border-gray-600/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-blue-400">Loads to Masses</h3>

        {!ltomDat && !loading && (
          <p className="text-xs text-gray-500">데이터 없음</p>
        )}

        {ltomDat && (
          <>
            {/* Direction & Load Types */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mass Direction</span>
                <div className="flex gap-1.5">
                  {(["X", "Y", "Z"] as const).map((d) => (
                    <span key={d} className={ltomDat[`DIR_${d}`] ? "text-green-400" : "text-gray-600"}>
                      {ltomDat[`DIR_${d}`] ? "\u2713" : "\u2717"}{d}
                    </span>
                  ))}
                </div>
              </div>
              <div />
              {([
                ["bNODAL", "Nodal Load"],
                ["bBEAM", "Beam Load"],
                ["bFLOOR", "Floor Load"],
                ["bPRES", "Pressure"],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className={ltomDat[key] ? "text-green-400" : "text-gray-600"}>
                    {ltomDat[key] ? "\u2713" : "\u2717"}
                  </span>
                </div>
              ))}
            </div>

            {/* Load Case List */}
            {ltomDat.vLC.length > 0 && (
              <div className="mt-2">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-600/50">
                      <th className="pb-1 pr-4 font-medium text-gray-400">Load Case</th>
                      <th className="pb-1 font-medium text-gray-400 text-right">Scale Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ltomDat.vLC.map((lc, i) => (
                      <tr key={i} className="border-b border-gray-700/30">
                        <td className="py-1 pr-4 text-white">{lc.LCNAME}</td>
                        <td className="py-1 text-gray-300 text-right">{lc.FACTOR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 설정 섹션 ──────────────────────────────────────────────────────────
function SettingsSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "loading">("idle");
  const [testResult, setTestResult] = useState<TestResult>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/settings`).then((r) => r.json()).then((d) => {
      setBaseUrl(d.base_url ?? "");
      setMaskedKey(d.api_key_masked ?? "");
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;
      const saveRes = await fetch(`${BACKEND_URL}/api/settings`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!saveRes.ok) throw new Error(`저장 실패: ${saveRes.status}`);
      setSaved(true);
      setApiKey("");
      const res = await fetch(`${BACKEND_URL}/api/settings`);
      if (res.ok) {
        const d = await res.json();
        setMaskedKey(d.api_key_masked ?? "");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestState("loading");
    setTestResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/test-connection`, { cache: "no-store" });
      setTestResult(await res.json());
    } catch (err) {
      setTestResult({ connected: false, message: String(err) });
    } finally {
      setTestState("idle");
    }
  };

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <h2 className="text-base font-semibold text-white mb-1">API 설정</h2>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:8090"
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
        {maskedKey && !apiKey && (
          <p className="text-xs text-gray-500 mb-1">현재: <span className="font-mono">{maskedKey}</span></p>
        )}
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password"
          placeholder="새 API Key 입력 (변경 시에만)"
          className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {testResult && (
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${testResult.connected ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"}`}>
          {testResult.connected
            ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
            : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
          <p className={`text-xs ${testResult.connected ? "text-green-300" : "text-red-300"}`}>{testResult.message}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={13} />저장됨</span>}
        <button type="button" onClick={handleTest} disabled={testState === "loading"}
          className="flex items-center gap-1.5 rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50 transition-colors">
          {testState === "loading" && <Loader2 size={13} className="animate-spin" />}
          연결 테스트
        </button>
        <button type="submit" disabled={saving}
          className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

// ── 층 설정 섹션 ────────────────────────────────────────────────────────
function StorySection({ onRowsChange }: { onRowsChange: (rows: StoryRow[]) => void }) {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/midas/db/STOR`);
      const d = await r.json();
      const stor: Record<string, Record<string, unknown>> = d?.STOR ?? {};

      // STORY_LEVEL 오름차순 정렬 후 HEIGHT 계산
      const sorted = Object.entries(stor)
        .map(([id, v]) => ({
          id,
          STORY_NAME:       String(v.STORY_NAME       ?? ""),
          STORY_LEVEL:      Number(v.STORY_LEVEL       ?? 0),
          bFLOOR_DIAPHRAGM: Boolean(v.bFLOOR_DIAPHRAGM ?? false),
        }))
        .sort((a, b) => a.STORY_LEVEL - b.STORY_LEVEL);

      const parsed: StoryRow[] = sorted.map((row, i) => ({
        ...row,
        HEIGHT: i === 0
          ? row.STORY_LEVEL                          // 최하층: 레벨 자체
          : row.STORY_LEVEL - sorted[i - 1].STORY_LEVEL,
      }));

      const reversed = parsed.reverse(); // 화면은 상층부터 표시
      setRows(reversed);
      onRowsChange(reversed);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">층 설정</h2>
        <button onClick={fetch_} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {rows.length === 0 && !loading && !error && (
        <p className="text-xs text-gray-500">데이터 없음</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium text-gray-400">StoryName</th>
                <th className="pb-2 pr-4 font-medium text-gray-400 text-right">StoryLevel</th>
                <th className="pb-2 pr-4 font-medium text-gray-400 text-right">StoryHeight</th>
                <th className="pb-2 font-medium text-gray-400 text-center">Diaphragm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-1.5 pr-4 text-white">{r.STORY_NAME}</td>
                  <td className="py-1.5 pr-4 text-gray-300 text-right">{r.STORY_LEVEL.toFixed(3)}</td>
                  <td className="py-1.5 pr-4 text-gray-300 text-right">{r.HEIGHT.toFixed(3)}</td>
                  <td className="py-1.5 text-center">
                    {r.bFLOOR_DIAPHRAGM
                      ? <span className="text-green-400">●</span>
                      : <span className="text-gray-600">○</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 대시보드 ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [address, setAddress] = useState("");
  const [storyRows, setStoryRows] = useState<StoryRow[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-gray-400 mt-1">MIDAS GEN NX API Dashboard</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProjectSection onAddressChange={setAddress} storyRows={storyRows} />
        <SettingsSection />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MapSection address={address} />
        <SelfWeightSection />
        <StorySection onRowsChange={setStoryRows} />
      </div>
    </div>
  );
}
