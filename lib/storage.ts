import type { AnalysisResult } from "./types";

// localStorage 캐시 유틸 (분석 결과용 — API 실패 시 폴백)

export function loadAnalysis(key: string): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`ci_analysis_${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAnalysis(key: string, analysis: AnalysisResult) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ci_analysis_${key}`, JSON.stringify(analysis));
  } catch {
    // quota exceeded
  }
}
