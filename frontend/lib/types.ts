export interface ProjectData {
  PROJECT: string;
  CLIENT: string;
  ADDRESS: string;
  COMMENT: string;
}

export type TestResult = { connected: boolean; message: string } | null;

export interface StoryRow {
  id: string;
  STORY_NAME: string;
  STORY_LEVEL: number;
  HEIGHT: number;
  bFLOOR_DIAPHRAGM: boolean;
}

export interface SelfWeightRow {
  id: string;
  LCNAME: string;
  GROUP_NAME: string;
  FV: number[];
  factor: number | null;
  valid: boolean;
}

export interface StructureMass {
  MASS_LABEL: string;
  SMASS_LABEL: string;
}

export interface LoadToMassData {
  DIR_X: boolean;
  DIR_Y: boolean;
  DIR_Z: boolean;
  bNODAL: boolean;
  bBEAM: boolean;
  bFLOOR: boolean;
  bPRES: boolean;
  vLC: { LCNAME: string; FACTOR: number }[];
}

export interface StoryWeightData {
  total_weight: number;
  gl_story: string;
  gl_level: number;
}

export interface StoryShearRow {
  story: string;
  level: number;
  rx_shear_x: number;
  rx_shear_y: number;
  rx_story_force: number;
  ry_shear_x: number;
  ry_shear_y: number;
  ry_story_force: number;
}

export interface EigenvalueRow {
  mode: number;
  frequency: number;
  period: number;
  mass_x: number;
  mass_y: number;
  mass_rotn_z: number;
  mass_z: number;
  mass_rotn_x: number;
  mass_rotn_y: number;
  sum_x: number;
  sum_y: number;
  sum_rotn_z: number;
  sum_z: number;
  sum_rotn_x: number;
  sum_rotn_y: number;
}

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
