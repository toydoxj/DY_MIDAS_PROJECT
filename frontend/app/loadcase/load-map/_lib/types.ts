export interface LoadMapBeam {
  elem_id: number;
  direction: "X" | "Y" | "SKEW";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LoadMapArea {
  fbld_name: string;
  polygon: [number, number][];
  z_level: number;
  dl: number;
  ll: number;
  factored: number;
}

export interface LoadMapLevel {
  z_level: number;
  story_name: string;
  beams: LoadMapBeam[];
  load_areas: LoadMapArea[];
}

export interface LoadMapResponse {
  level_count: number;
  total_area_count: number;
  reports: LoadMapLevel[];
}

export interface LoadMapStory {
  name: string;
  level: number;
  height: number;
}
