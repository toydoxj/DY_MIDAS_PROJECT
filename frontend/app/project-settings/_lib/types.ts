export interface GridAxisItem {
  label: string;
  offset: number;
}

export type GridLabelFormat = "prefix" | "simple";

export interface GridAxisGroup {
  name: string;
  angle_deg: number;
  origin: [number, number];
  axes: GridAxisItem[];
  color: string;
}

export interface ProjectGridSettings {
  angle_deg: number;
  origin: [number, number];
  x_axes: GridAxisItem[];
  y_axes: GridAxisItem[];
  label_format: GridLabelFormat;
  auto_detected: boolean;
  extra_groups: GridAxisGroup[];
}

export interface GridAutoDetectResult {
  angle_deg: number;
  origin: [number, number];
  x_offsets: number[];
  y_offsets: number[];
}
