/** 철근 규격 (공칭 단면적 mm²) */
export const REBAR_OPTIONS = [
  { dia: 10, area: 71.3, label: "D10" },
  { dia: 13, area: 126.7, label: "D13" },
  { dia: 16, area: 198.6, label: "D16" },
  { dia: 19, area: 286.5, label: "D19" },
  { dia: 22, area: 387.1, label: "D22" },
  { dia: 25, area: 506.7, label: "D25" },
  { dia: 29, area: 642.4, label: "D29" },
  { dia: 32, area: 794.2, label: "D32" },
  { dia: 35, area: 956.6, label: "D35" },
] as const;

/** 기본 재료 강도 */
export const DEFAULT_FCK = 27;
export const DEFAULT_FY = 400;
export const DEFAULT_FYT = 400;
export const DEFAULT_COVER = 40;
