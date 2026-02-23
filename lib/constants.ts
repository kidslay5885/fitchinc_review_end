import type { Platform } from "./types";

export const DEFAULT_PLATFORMS: Platform[] = [
  { id: "p1", name: "핏크닉", instructors: [] },
  { id: "p2", name: "머니업클래스", instructors: [] },
];

export const KNOWN_INSTRUCTORS: Record<string, string[]> = {
  핏크닉: ["민대표", "김작가", "이쇼츠", "킴브로", "윙스"],
  머니업클래스: ["셀팜", "머니테이커", "킴브로", "윙스"],
};

// Column mapping patterns for XLSX parsing (matched to actual Naver Form headers)
// Order matters: first match wins per header. More specific patterns first.
export const COLUMN_PATTERNS: Record<string, RegExp> = {
  // --- PRE survey fields ---
  name: /수강생.*이름|이름|성명|성함/i,
  gender: /성별/i,
  age: /연령|나이/i,
  job: /하고.*계신.*일|직업|직종/i,
  hours: /투자.*시간|부업.*시간/i,
  channel: /알게.*경로|경로.*알게|유입.*경로/i,
  computer: /컴퓨터.*활용|PC.*활용|활용.*능력/i,
  goal: /벌고.*싶은.*수익|목표.*수익|수익.*목표|목표.*금액/i,
  hopePlatform: /핏크닉.*바라|머니업.*바라/i,
  hopeInstructor: /강사.*바라|걱정.*강사/i,
  // --- POST survey fields ---
  pSat: /만족스러웠던.*점/i,
  ps1: /커리큘럼.*만족/i,
  ps2: /피드백.*적절|피드백.*이루어/i,
  pFmt: /선호.*방식|강의.*형태/i,
  pFree: /하고.*싶은.*말|편하게.*적어|자유.*의견/i,
  pRec: /추천.*지인|지인.*추천|추천하실/i,
};

export const THEME_COLORS = {
  ac: "#3451B2",
  acs: "rgba(52,81,178,0.06)",
  acm: "rgba(52,81,178,0.14)",
  gd: "#1A8754",
  gds: "rgba(26,135,84,0.06)",
  wn: "#B45309",
  wns: "rgba(180,83,9,0.06)",
  bd: "#C13838",
  bds: "rgba(193,56,56,0.06)",
  vt: "#6D4AE6",
  vts: "rgba(109,74,230,0.06)",
};
