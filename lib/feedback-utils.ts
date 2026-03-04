import type { Comment } from "./types";

export type TagValue = Comment["tag"];

/** 네이버 폼(설문) 항목별 표시 라벨 — 실제 설문 질문 + 출처 */
export const FIELD_LABELS: Record<string, string> = {
  selectReason: "강사님 강의를 선택하신 이유 (사전 설문)",
  hopePlatform: "플랫폼에 바라는 점 (사전 설문)",
  hopeInstructor: "강사에게 바라는 점 (사전 설문)",
  prevExperience: "타 플랫폼 강의 수강 경험 (사전 설문)",
  prevCourse: "다른 정규강의 수강 이력 (사전 설문)",
  expectedBenefit: "이번 강의 혜택 중 가장 기대되는 혜택 (사전 설문)",
  satOther: "'기타' 선택 시 어떤 점이 만족스러웠나요 (후기 설문)",
  lowScoreReason: "커리큘럼 만족도 2점 이하 선택 이유 (후기 설문)",
  lowFeedbackRequest: "피드백 만족도 5점 이하 시 바라는 점 (후기 설문)",
  pFree: "하고 싶은 말씀을 편하게 적어주세요 (후기 설문)",
  pRec: "이 강의를 지인분들께 추천하실 것 같으신가요 (후기 설문)",
};

export const FIELD_ORDER = [
  "selectReason",
  "hopePlatform",
  "hopeInstructor",
  "satOther",
  "lowScoreReason",
  "lowFeedbackRequest",
  "pFree",
  "pRec",
  "prevExperience",
  "prevCourse",
  "expectedBenefit",
];

/** 세부 분류에서 디폴트로 제외되는 항목 */
export const DEFAULT_EXCLUDED_FIELDS = ["prevExperience", "prevCourse", "expectedBenefit", "pRec"];

export const NOISE_RE =
  /^(네|예|아니요|없습니다|없음|감사합니다|고맙습니다|좋습니다|좋았습니다|잘 모르겠습니다|모르겠습니다|잘 모르겠어요|특별히 없습니다|딱히 없습니다|아직 없습니다|아직 없어요|별로 없습니다|별로 없어요|글쎄요|x|X|-|강의 내용|커리큘럼|피드백|추천합니다|네 추천합니다|예 추천합니다|네 너무 좋습니다|없어요|없읒|특별한 건 없습니다|특별한 건 없어요|없는 것 같습니다|없는 것 같아요|생각이 안 납니다|생각이 안 나요|[.\s]*)$/;

export const TAG_OPTIONS = [
  { value: "" as const, label: "미분류", color: "bg-gray-50 text-gray-500 border-gray-200" },
  { value: "platform_pm" as const, label: "PM", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "platform_pd" as const, label: "PD", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "platform_cs" as const, label: "CS", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "platform_general" as const, label: "플랫폼", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "platform_etc" as const, label: "기타", color: "bg-slate-50 text-slate-600 border-slate-200" },
  { value: "instructor" as const, label: "강사", color: "bg-orange-50 text-orange-700 border-orange-200" },
];

export function getTagColor(tag: TagValue): string {
  return TAG_OPTIONS.find((o) => o.value === (tag || ""))?.color || TAG_OPTIONS[0].color;
}

export function getTagLabel(tag: TagValue): string {
  return TAG_OPTIONS.find((o) => o.value === (tag || ""))?.label || "미분류";
}

export function isPlatformTag(tag: TagValue): boolean {
  return (
    tag === "platform_pm" ||
    tag === "platform_pd" ||
    tag === "platform_cs" ||
    tag === "platform_general" ||
    tag === "platform_etc"
  );
}

export function isUsefulComment(c: { original_text: string; source_field: string }): boolean {
  const text = c.original_text.trim();
  if (text.length < 5) return false;
  if (NOISE_RE.test(text)) return false;
  return true;
}

// source_field 기반 자동 추천 태그 (tag가 null일 때 사용)
export function suggestTag(sourceField: string): TagValue {
  if (sourceField === "hopePlatform") return "platform_general";
  if (sourceField === "pFree") return "platform_etc";
  if (
    ["hopeInstructor", "selectReason", "satOther", "lowScoreReason", "lowFeedbackRequest"].includes(sourceField)
  ) return "instructor";
  return null; // pRec 등
}

export function effectiveTag(c: { tag: TagValue; source_field: string }): TagValue {
  return c.tag ?? suggestTag(c.source_field);
}

export function sortByFieldOrder<T extends { source_field: string }>(
  groups: [string, T[]][]
): [string, T[]][] {
  return groups.sort(([a], [b]) => {
    const ai = FIELD_ORDER.indexOf(a);
    const bi = FIELD_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function groupByField<T extends { source_field: string }>(
  items: T[]
): [string, T[]][] {
  const groups: Record<string, T[]> = {};
  for (const c of items) {
    const key = c.source_field;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return sortByFieldOrder(Object.entries(groups));
}

export interface CommentWithCohort extends Comment {
  cohortLabel?: string;
}

export type ViewMode = "all" | "platform" | "instructor" | "untagged";
export type PlatformSub = "all" | "pm" | "pd" | "cs" | "platform" | "etc";
