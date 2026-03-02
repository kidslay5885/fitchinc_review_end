import type { Comment } from "./types";

export type TagValue = Comment["tag"];

/** 네이버 폼(설문) 항목별 표시 라벨 — 검수·전달 시 PM이 구분하기 쉬운 이름 */
export const FIELD_LABELS: Record<string, string> = {
  hopePlatform: "플랫폼에 바라는 점",
  hopeInstructor: "강사에게 바라는 점",
  pFree: "자유 의견",
  lowScoreReason: "커리큘럼 불만족 사유",
  lowFeedbackRequest: "피드백 개선 요청",
  prevExperience: "타 플랫폼 강의 수강 경험",
  prevCourse: "핏크닉 다른 정규강의 수강 이력",
  selectReason: "강사님 강의를 선택하신 이유",
  expectedBenefit: "이번 강의 혜택 중 가장 기대되는 혜택",
  satOther: "기타 만족 사유",
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

export const NOISE_RE =
  /^(네|예|아니요|없습니다|없음|감사합니다|고맙습니다|좋습니다|좋았습니다|잘 모르겠습니다|모르겠습니다|특별히 없습니다|딱히 없습니다|아직 없습니다|글쎄요|x|X|-|강의 내용|커리큘럼|피드백|추천합니다|네 추천합니다|예 추천합니다|네 너무 좋습니다|없어요|없읒|[.\s]*)$/;

export const TAG_OPTIONS = [
  { value: "" as const, label: "미분류", color: "bg-gray-50 text-gray-500 border-gray-200" },
  { value: "platform_pm" as const, label: "PM", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "platform_pd" as const, label: "PD", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "platform_cs" as const, label: "CS", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
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
  if (sourceField === "hopePlatform" || sourceField === "pFree") return "platform_etc";
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
export type PlatformSub = "all" | "pm" | "pd" | "cs" | "etc";
