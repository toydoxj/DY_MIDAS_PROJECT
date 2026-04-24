export type SlabType = "1방향" | "2방향";

export interface Story {
  name: string;
  level: number;
  height: number;
}

export interface BeamSegment {
  elem_id: number;
  direction: "X" | "Y";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FloorLoadBreakdownItem {
  name: string;
  dl: number;
  ll: number;
  factored: number;
  is_primary: boolean;
}

export interface Panel {
  panel_id: string;
  z_level: number;
  story_name: string;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  lx: number;
  ly: number;
  short_span: number;
  long_span: number;
  aspect_ratio: number;
  slab_type: SlabType;
  area: number;
  beam_left: number;
  beam_right: number;
  beam_bottom: number;
  beam_top: number;
  floor_load_name?: string | null;
  floor_load_dl?: number | null;
  floor_load_ll?: number | null;
  floor_load_total?: number | null;
  floor_load_factored?: number | null;
  floor_load_matches?: FloorLoadBreakdownItem[];
}

export interface LevelReport {
  z_level: number;
  story_name: string;
  panel_count: number;
  one_way_count: number;
  two_way_count: number;
  max_span: number;
  panels: Panel[];
  beams: BeamSegment[];
}

export interface SlabSpanAnalyzeResponse {
  level_count: number;
  total_panels: number;
  reports: LevelReport[];
  floor_load_area_count?: number;
  floor_load_matched_count?: number;
}

export interface SlabSpanAnalyzeRequest {
  story_names?: string[] | null;
  exclude_section_prefixes?: string[];
  z_tol?: number;
  skew_tol_deg?: number;
  pos_tol?: number;
  min_span?: number;
  merge_beams?: boolean;
}

export interface SnapshotListItem {
  name: string;
  saved_at: string;
  total_panels: number;
  level_count: number;
}

export interface SnapshotFull {
  name: string;
  saved_at: string;
  analysis: SlabSpanAnalyzeResponse;
  names: Record<string, string>;
  sections?: SlabSectionItem[];
}

export type SlabSectionType = "A" | "B" | "C" | "D" | "E" | "";

export interface SlabSectionItem {
  name: string;
  type: SlabSectionType;
  thk: number | null;
  x1: string;
  x2: string;
  x3: string;
  x4: string;
  x5: string;
  y1: string;
  y2: string;
  y3: string;
  y4: string;
  y5: string;
  note: string;
}

export function emptySlabSection(name: string = ""): SlabSectionItem {
  return {
    name,
    type: "",
    thk: null,
    x1: "", x2: "", x3: "", x4: "", x5: "",
    y1: "", y2: "", y3: "", y4: "", y5: "",
    note: "",
  };
}
