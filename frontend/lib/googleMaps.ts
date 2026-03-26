import { BACKEND_URL } from "./types";

export const OVERLAY_BOUNDS = { north: 38.7502, south: 32.6992, west: 124.0089, east: 131.6824 };

export const DARK_MAP_STYLES = [
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

declare const google: any; // eslint-disable-line @typescript-eslint/no-explicit-any

let _loadPromise: Promise<void> | null = null;
export function loadGoogleMaps(): Promise<void> {
  if (typeof google !== "undefined" && google.maps?.Map) return Promise.resolve();
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
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
