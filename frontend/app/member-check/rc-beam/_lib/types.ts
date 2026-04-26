/** 배근 입력 (위치별) */
export interface RebarInput {
  position: "I" | "C" | "J";
  note: string;
  top_dia: number;
  top_count: number;
  bot_dia: number;
  bot_count: number;
  stirrup_dia: number;
  stirrup_legs: number;
  stirrup_spacing: number;
  cover: number;
}

/** 배근 형식 */
export type RebarType = "type3" | "type2" | "type1";

/** 단면별 배근 입력 */
export interface SectionRebarInput {
  section_name: string;
  B: number;
  H: number;
  fck: number;
  fy: number;
  fyt: number;
  rebarType: RebarType;
  rebars: RebarInput[];
}

/** 검토 요청 */
export interface BeamDesignCheckRequest {
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

/** 부재력 최대값 (단면별 그룹) — page → fetch 훅 → 컴포넌트 공용 */
export interface BeamForceMaxRow {
  SectName: string;
  B: number | null;
  H: number | null;
  D: number | null;
  My_neg_I_LC: string; My_neg_I: number;
  My_pos_I_LC: string; My_pos_I: number;
  Fz_I_LC: string; Fz_I: number;
  My_neg_C_LC: string; My_neg_C: number;
  My_pos_C_LC: string; My_pos_C: number;
  Fz_C_LC: string; Fz_C: number;
  My_neg_J_LC: string; My_neg_J: number;
  My_pos_J_LC: string; My_pos_J: number;
  Fz_J_LC: string; Fz_J: number;
}

/** 부재별 그룹 결과 */
export interface MemberForceMaxRow {
  Memb: number;
  My_neg_I_LC: string; My_neg_I: number;
  My_pos_I_LC: string; My_pos_I: number;
  Fz_I_LC: string; Fz_I: number;
  My_neg_C_LC: string; My_neg_C: number;
  My_pos_C_LC: string; My_pos_C: number;
  Fz_C_LC: string; Fz_C: number;
  My_neg_J_LC: string; My_neg_J: number;
  My_pos_J_LC: string; My_pos_J: number;
  Fz_J_LC: string; Fz_J: number;
}

/** 검토 결과 (위치별) */
export interface PositionCheckResult {
  section_name: string;
  position: string;
  neg_Mu_d: number;
  neg_phi_Mn: number;
  neg_flexure_dcr: number;
  neg_flexure_ok: boolean;
  pos_Mu_d: number;
  pos_phi_Mn: number;
  pos_flexure_dcr: number;
  pos_flexure_ok: boolean;
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
