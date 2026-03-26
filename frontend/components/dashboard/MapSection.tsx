"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MapPin, Search } from "lucide-react";
import { loadGoogleMaps, OVERLAY_BOUNDS, DARK_MAP_STYLES } from "@/lib/googleMaps";

declare const google: any; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function MapSection({ address }: { address: string }) {
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

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 35.8, lng: 127.8 }, zoom: 7, minZoom: 7, maxZoom: 7,
        mapTypeId: "roadmap", disableDefaultUI: true, gestureHandling: "none", keyboardShortcuts: false, styles: DARK_MAP_STYLES,
      });
      mapInstance.current = map;
      geocoder.current = new google.maps.Geocoder();

      class ContourOverlay extends google.maps.OverlayView {
        _opacity = 0.95; div: HTMLDivElement | null = null; bg: HTMLDivElement | null = null; img = new Image();
        constructor() { super(); this.img.src = "/windloadmap_warped.png"; }
        onAdd() {
          this.div = document.createElement("div"); this.div.style.cssText = "position:absolute;";
          this.bg = document.createElement("div"); this.bg.style.cssText = `width:100%;height:100%;position:absolute;background:white;opacity:${this._opacity};`;
          this.img.style.cssText = `width:100%;height:100%;position:absolute;opacity:${this._opacity};`;
          this.div.appendChild(this.bg); this.div.appendChild(this.img); this.getPanes().overlayLayer.appendChild(this.div);
        }
        draw() {
          const proj = this.getProjection(); if (!proj || !this.div) return;
          const sw = proj.fromLatLngToDivPixel(new google.maps.LatLng(OVERLAY_BOUNDS.south, OVERLAY_BOUNDS.west));
          const ne = proj.fromLatLngToDivPixel(new google.maps.LatLng(OVERLAY_BOUNDS.north, OVERLAY_BOUNDS.east));
          this.div.style.left = sw.x + "px"; this.div.style.top = ne.y + "px";
          this.div.style.width = (ne.x - sw.x) + "px"; this.div.style.height = (sw.y - ne.y) + "px";
        }
        onRemove() { this.div?.remove(); }
        setOpacity(v: number) { this._opacity = v; if (this.img) this.img.style.opacity = String(v); if (this.bg) this.bg.style.opacity = String(v); }
      }
      const overlay = new ContourOverlay(); overlay.setMap(map); overlayRef.current = overlay; setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { overlayRef.current?.setOpacity(opacity); }, [opacity]);

  const searchAddress = useCallback((addr: string) => {
    if (!addr.trim() || !geocoder.current || !mapInstance.current) return;
    setSearching(true); setError(null);
    geocoder.current.geocode({ address: addr, region: "KR" }, (results: any[], status: string) => {
      setSearching(false);
      if (status !== "OK" || !results?.length) { setError("주소를 찾을 수 없습니다."); setResult(null); return; }
      const loc = results[0].geometry.location;
      const lat = loc.lat(); const lng = loc.lng(); const fullAddr = results[0].formatted_address;
      markerInner.current?.setMap(null); markerOuter.current?.setMap(null);
      markerOuter.current = new google.maps.Circle({ center: { lat, lng }, radius: 12000, fillColor: "transparent", fillOpacity: 0, strokeColor: "#ef4444", strokeOpacity: 0.9, strokeWeight: 2.5, map: mapInstance.current, zIndex: 10 });
      markerInner.current = new google.maps.Circle({ center: { lat, lng }, radius: 5000, fillColor: "#ef4444", fillOpacity: 0.85, strokeColor: "#ffffff", strokeOpacity: 0.9, strokeWeight: 1.5, map: mapInstance.current, zIndex: 11 });
      setResult({ addr: fullAddr, lat, lng });
    });
  }, []);

  const lastSearched = useRef("");
  useEffect(() => {
    if (!ready || !address.trim() || address === lastSearched.current) return;
    const timer = setTimeout(() => { lastSearched.current = address; searchAddress(address); }, 800);
    return () => clearTimeout(timer);
  }, [address, ready, searchAddress]);

  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2"><MapPin size={16} /> MAPS</h2>
          <p className="text-[10px] text-gray-500 mt-0.5 ml-6">해당 지도는 실제 지도와 정확히 일치하지 않으므로 정밀한 확인 필요</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>등치선</span>
            <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-16 accent-blue-500 cursor-pointer" />
            <span className="font-mono text-blue-400 w-8">{Math.round(opacity * 100)}%</span>
          </div>
          <button onClick={() => searchAddress(address)} disabled={searching || !ready || !address.trim()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors">
            <Search size={13} className={searching ? "animate-spin" : ""} /> 위치 검색
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && (
        <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-3 py-2 text-xs text-gray-300 flex items-center gap-4">
          <span className="text-white">{result.addr}</span><span className="text-gray-500">|</span>
          <span>위도 {result.lat.toFixed(5)}</span><span>경도 {result.lng.toFixed(5)}</span>
        </div>
      )}
      <div ref={mapRef} className="w-full rounded-lg overflow-hidden flex-1" style={{ minHeight: 610 }} />
    </div>
  );
}
