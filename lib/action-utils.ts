import type { ActionTag, ProcessStatus, CommentWithAction } from "./types";

// ===== 액션 태그 상수 =====

export const ACTION_TAGS: {
  value: ActionTag;
  label: string;
  aiLabel: string;
  color: string;
  bgColor: string;
}[] = [
  { value: "instructor", label: "강사", aiLabel: "강사", color: "text-orange-700", bgColor: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "pm", label: "PM", aiLabel: "PM", color: "text-blue-700", bgColor: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "pd", label: "PD", aiLabel: "PD", color: "text-indigo-700", bgColor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "dev", label: "개발", aiLabel: "개발", color: "text-emerald-700", bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "cs", label: "CS", aiLabel: "CS", color: "text-cyan-700", bgColor: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "no_action", label: "기타", aiLabel: "액션없음", color: "text-gray-500", bgColor: "bg-gray-50 text-gray-500 border-gray-200" },
];

// AI 출력 한글 → DB 영문 매핑
export const AI_LABEL_TO_TAG: Record<string, ActionTag> = {
  "강사": "instructor",
  "PM": "pm",
  "PD": "pd",
  "개발": "dev",
  "CS": "cs",
  "액션없음": "no_action",
};

// DB 영문 → 한글 매핑
export const TAG_TO_AI_LABEL: Record<ActionTag, string> = {
  instructor: "강사",
  pm: "PM",
  pd: "PD",
  dev: "개발",
  cs: "CS",
  no_action: "액션없음",
};

// ===== 처리 상태 옵션 =====

export const PROCESS_OPTIONS: {
  value: ProcessStatus;
  label: string;
  color: string;
  bgColor: string;
  memoRequired: boolean;
}[] = [
  { value: "self_resolved", label: "검토완료", color: "text-green-700", bgColor: "bg-green-50 hover:bg-green-100 border-green-300", memoRequired: false },
  { value: "needs_discussion", label: "협의 필요", color: "text-blue-700", bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-300", memoRequired: true },
  { value: "next_cohort", label: "다음 기수", color: "text-amber-700", bgColor: "bg-amber-50 hover:bg-amber-100 border-amber-300", memoRequired: false },
];

// ===== 헬퍼 함수 =====

export function getActionTagColor(tag: ActionTag | null): string {
  return ACTION_TAGS.find((t) => t.value === tag)?.bgColor ?? ACTION_TAGS[5].bgColor;
}

export function getActionTagLabel(tag: ActionTag | null): string {
  return ACTION_TAGS.find((t) => t.value === tag)?.label ?? "미분류";
}

export function getActionTagTextColor(tag: ActionTag | null): string {
  return ACTION_TAGS.find((t) => t.value === tag)?.color ?? "text-gray-500";
}

export function getProcessLabel(status: ProcessStatus | null): string {
  return PROCESS_OPTIONS.find((o) => o.value === status)?.label ?? "";
}

export function getProcessColor(status: ProcessStatus | null): string {
  return PROCESS_OPTIONS.find((o) => o.value === status)?.bgColor ?? "";
}

export function isProcessed(comment: CommentWithAction): boolean {
  return comment.process_status !== null && comment.process_status !== undefined;
}

export function buildScopeKey(platform: string, instructor: string, course: string, cohort: string): string {
  return `${platform}:${instructor}:${course}:${cohort}`;
}

// 분류 대상인지 판별 (무의미한 짧은 텍스트 제외)
const SKIP_TEXTS = ["없음", "없습니다", "없어요", "없다", "x", "X", ".", "..", "...", "-"];
const TARGET_FIELDS = ["hopeInstructor", "hopePlatform", "pFree", "lowFeedbackRequest", "satOther", "lowScoreReason"];

export function isClassifiableComment(c: { original_text: string; source_field: string }): boolean {
  if (!TARGET_FIELDS.includes(c.source_field)) return false;
  const text = c.original_text?.trim();
  if (!text || text.length < 5) return false;
  if (SKIP_TEXTS.includes(text)) return false;
  return true;
}

// 역할별 탭 순서 (액션없음 제외한 5개 + 액션없음)
export const ACTION_TAG_ORDER: ActionTag[] = ["instructor", "pm", "pd", "dev", "cs", "no_action"];
