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

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
