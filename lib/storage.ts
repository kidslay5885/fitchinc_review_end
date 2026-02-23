import type { Platform, NoteData, AnalysisResult } from "./types";

const STORAGE_KEYS = {
  platforms: "ci_platforms",
  notes: "ci_notes",
  analysis: "ci_analysis",
} as const;

export function loadPlatforms(): Platform[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.platforms);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePlatforms(platforms: Platform[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Strip rawData to fit within localStorage 5MB limit
    // rawData alone can be ~3MB for 90+ files, but it's not used in the UI
    const stripped = platforms.map((p) => ({
      ...p,
      instructors: p.instructors.map((i) => ({
        ...i,
        cohorts: i.cohorts.map((c) => ({
          ...c,
          preResponses: c.preResponses.map(({ rawData, ...rest }) => ({
            ...rest,
            rawData: {},
          })),
          postResponses: c.postResponses.map(({ rawData, ...rest }) => ({
            ...rest,
            rawData: {},
          })),
        })),
      })),
    }));
    const json = JSON.stringify(stripped);
    localStorage.setItem(STORAGE_KEYS.platforms, json);
    return true;
  } catch {
    console.warn("[ClassInsight] localStorage 저장 실패 - 용량 초과 가능성");
    return false;
  }
}

export function loadNotes(cohortId: string): NoteData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.notes}_${cohortId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveNotes(cohortId: string, notes: NoteData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.notes}_${cohortId}`, JSON.stringify(notes));
  } catch {
    // quota exceeded
  }
}

export function loadAnalysis(cohortId: string): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.analysis}_${cohortId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAnalysis(cohortId: string, analysis: AnalysisResult) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.analysis}_${cohortId}`, JSON.stringify(analysis));
  } catch {
    // quota exceeded
  }
}
