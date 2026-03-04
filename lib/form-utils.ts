import type { FormField } from "./types";
import { TEXT_FIELDS, PRE_FIELDS, POST_FIELDS, NOISE_PATTERNS } from "./csv-parser";

// ===== 기본 필드 템플릿 (XLSX 구조 기반) =====

const DEMOGRAPHICS_FIELDS: FormField[] = [
  { key: "name", label: "이름", type: "text", required: true, enabled: true, order: 1, section: "demographics", placeholder: "수강생 이름" },
  { key: "gender", label: "성별", type: "radio", required: false, enabled: true, order: 2, section: "demographics", options: ["남", "여"] },
  { key: "age", label: "연령대", type: "select", required: false, enabled: true, order: 3, section: "demographics", options: ["10대", "20대", "30대", "40대", "50대", "60대 이상"] },
  { key: "job", label: "현재 하고 계신 일", type: "text", required: false, enabled: true, order: 4, section: "demographics", placeholder: "직업을 입력해주세요" },
  { key: "hours", label: "부업에 투자 가능한 시간", type: "select", required: false, enabled: true, order: 5, section: "demographics", options: ["1시간 미만", "1~2시간", "2~3시간", "3~4시간", "4시간 이상"] },
  { key: "channel", label: "강의를 알게 된 경로", type: "text", required: false, enabled: true, order: 6, section: "demographics", placeholder: "예: 인스타그램, 유튜브, 지인 추천 등" },
  { key: "computer", label: "컴퓨터 활용 능력 (1~5점)", type: "scale", required: false, enabled: true, order: 7, section: "demographics", scaleMin: 1, scaleMax: 5 },
  { key: "goal", label: "목표 수익", type: "text", required: false, enabled: true, order: 8, section: "demographics", placeholder: "월 목표 수익을 입력해주세요" },
];

const PRE_FREETEXT_FIELDS: FormField[] = [
  { key: "selectReason", label: "강사님 강의를 선택하신 이유", type: "textarea", required: false, enabled: true, order: 20, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "hopePlatform", label: "플랫폼에 바라는 점", type: "textarea", required: false, enabled: true, order: 21, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "hopeInstructor", label: "강사에게 바라는 점", type: "textarea", required: false, enabled: true, order: 22, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "prevCourse", label: "다른 정규강의 수강 이력", type: "textarea", required: false, enabled: false, order: 23, section: "freetext", placeholder: "있으시다면 적어주세요" },
  { key: "prevExperience", label: "타 플랫폼 수강 경험", type: "textarea", required: false, enabled: false, order: 24, section: "freetext", placeholder: "있으시다면 적어주세요" },
  { key: "expectedBenefit", label: "기대되는 혜택", type: "textarea", required: false, enabled: false, order: 25, section: "freetext", placeholder: "가장 기대되는 혜택을 적어주세요" },
];

const POST_SCORE_FIELDS: FormField[] = [
  { key: "ps1", label: "커리큘럼 만족도", type: "scale", required: false, enabled: true, order: 10, section: "scores", scaleMin: 1, scaleMax: 5 },
  { key: "ps2", label: "피드백 만족도", type: "scale", required: false, enabled: true, order: 11, section: "scores", scaleMin: 1, scaleMax: 5 },
  { key: "pSat", label: "만족스러웠던 점", type: "textarea", required: false, enabled: true, order: 12, section: "scores", placeholder: "어떤 점이 만족스러웠나요?" },
  { key: "pFmt", label: "선호하는 강의 형태", type: "text", required: false, enabled: true, order: 13, section: "scores", placeholder: "예: 라이브, VOD, 혼합 등" },
];

const POST_FREETEXT_FIELDS: FormField[] = [
  { key: "pFree", label: "하고 싶은 말씀을 편하게 적어주세요", type: "textarea", required: false, enabled: true, order: 20, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "pRec", label: "이 강의를 지인분들께 추천하실 것 같으신가요?", type: "textarea", required: false, enabled: true, order: 21, section: "freetext", placeholder: "추천 여부와 이유를 적어주세요" },
  { key: "satOther", label: "기타 만족스러웠던 점", type: "textarea", required: false, enabled: false, order: 22, section: "freetext", placeholder: "기타 의견을 적어주세요" },
  { key: "lowScoreReason", label: "커리큘럼 2점 이하 선택 이유", type: "textarea", required: false, enabled: false, order: 23, section: "freetext", placeholder: "불만족 이유를 적어주세요" },
  { key: "lowFeedbackRequest", label: "피드백 5점 이하 시 바라는 점", type: "textarea", required: false, enabled: false, order: 24, section: "freetext", placeholder: "개선 바라는 점을 적어주세요" },
];

export const PRE_SURVEY_DEFAULTS: FormField[] = [
  ...DEMOGRAPHICS_FIELDS,
  ...PRE_FREETEXT_FIELDS,
];

export const POST_SURVEY_DEFAULTS: FormField[] = [
  ...DEMOGRAPHICS_FIELDS,
  ...POST_SCORE_FIELDS,
  ...POST_FREETEXT_FIELDS,
];

// ===== camelCase 폼 키 → snake_case DB 컬럼 매핑 =====

export const KEY_TO_COLUMN: Record<string, string> = {
  name: "name",
  gender: "gender",
  age: "age",
  job: "job",
  hours: "hours",
  channel: "channel",
  computer: "computer",
  goal: "goal",
  hopePlatform: "hope_platform",
  hopeInstructor: "hope_instructor",
  ps1: "ps1",
  ps2: "ps2",
  pSat: "p_sat",
  pFmt: "p_fmt",
  pFree: "p_free",
  pRec: "p_rec",
};

// survey_responses 테이블에 직접 저장되는 키
const RESPONSE_COLUMN_KEYS = new Set(Object.keys(KEY_TO_COLUMN));

// ===== 폼 응답 → DB 행 변환 =====

export function responseToDbRow(
  answers: Record<string, string>,
  surveyId: string,
  isPre: boolean,
  index: number
): Record<string, unknown> {
  const row: Record<string, unknown> = { survey_id: surveyId };
  const rawData: Record<string, string> = {};

  for (const [key, value] of Object.entries(answers)) {
    const col = KEY_TO_COLUMN[key];
    if (col) {
      // 점수 필드는 number로 변환
      if (["computer", "ps1", "ps2"].includes(key)) {
        row[col] = isPre && (key === "ps1" || key === "ps2") ? 0 : (parseFloat(value) || 0);
      } else if (isPre && ["pSat", "pFmt", "pFree", "pRec"].includes(key)) {
        row[col] = "";
      } else {
        row[col] = value || "";
      }
    } else if (!key.startsWith("_")) {
      // custom 필드는 raw_data에 저장
      if (value) rawData[key] = value;
    }
  }

  // 필수 기본값
  if (!row.name) row.name = `응답자${index + 1}`;
  row.raw_data = rawData;

  return row;
}

// ===== 폼 응답에서 댓글 추출 =====

export interface ExtractedComment {
  respondent: string;
  original_text: string;
  source_field: string;
}

export function extractCommentsFromResponse(
  answers: Record<string, string>,
  respondentName: string,
  isPre: boolean
): ExtractedComment[] {
  const comments: ExtractedComment[] = [];

  for (const field of TEXT_FIELDS) {
    if (isPre && !PRE_FIELDS.has(field)) continue;
    if (!isPre && !POST_FIELDS.has(field)) continue;

    const text = (answers[field] || "").trim();
    if (!text || text.length < 5) continue;
    if (/^[.\s]*$/.test(text) || NOISE_PATTERNS.test(text)) continue;

    comments.push({
      respondent: respondentName || "익명",
      original_text: text,
      source_field: field,
    });
  }

  return comments;
}
