/** 배근 입력 (위치별) */
export interface RebarInput {
  position: "I" | "C" | "J";
  top_dia: number;
  top_count: number;
  bot_dia: number;
  bot_count: number;
  stirrup_dia: number;
  stirrup_spacing: number;
  cover: number;
}

/** 단면별 배근 입력 */
export interface SectionRebarInput {
  section_name: string;
  B: number;
  H: number;
  rebars: RebarInput[];
}

/** 검토 요청 */
export interface BeamDesignCheckRequest {
  fck: number;
  fy: number;
  fyt: number;
  sections: SectionRebarInput[];
  forces: BeamForceMaxRowForCheck[];
}

/** 부재력 (검토용, 기존 BeamForceMaxRow와 동일 구조) */
export interface BeamForceMaxRowForCheck {
  SectName: string;
  B?: number | null;
  H?: number | null;
  My_neg_I: number; My_pos_I: number; Fz_I: number;
  My_neg_C: number; My_pos_C: number; Fz_C: number;
  My_neg_J: number; My_pos_J: number; Fz_J: number;
  [key: string]: unknown;
}

/** 검토 결과 (위치별) */
export interface PositionCheckResult {
  section_name: string;
  position: string;
  Mu_d: number;
  phi_Mn: number;
  flexure_dcr: number;
  flexure_ok: boolean;
  Vu_d: number;
  phi_Vn: number;
  shear_dcr: number;
  shear_ok: boolean;
  rho: number;
  rho_min: number;
  rho_max: number;
  rho_min_ok: boolean;
  rho_max_ok: boolean;
  stirrup_spacing: number;
  stirrup_max_spacing: number;
  stirrup_ok: boolean;
  all_ok: boolean;
}
