import type { FormField } from "./types";
import { TEXT_FIELDS, PRE_FIELDS, POST_FIELDS, NOISE_PATTERNS } from "./csv-parser";

// ===== 기본 필드 템플릿 (실제 XLSX 설문지 기반) =====

const DEMOGRAPHICS_FIELDS: FormField[] = [
  { key: "name", label: "수강생 이름", type: "text", required: true, enabled: true, order: 1, section: "demographics", placeholder: "이름을 입력해주세요" },
  { key: "gender", label: "성별", type: "radio", required: true, enabled: true, order: 2, section: "demographics", options: ["남성", "여성"] },
  { key: "age", label: "연령대", type: "radio", required: true, enabled: true, order: 3, section: "demographics", options: ["20대", "30대", "40대", "50대", "60대 이상"] },
  { key: "job", label: "현재 하고 계신 일이 무엇인가요?", type: "radio", required: true, enabled: true, order: 4, section: "demographics", options: ["직장인", "자영업자", "전업주부", "프리랜서", "퇴직자", "기타"] },
  { key: "hours", label: "하루에 평균적으로 부업에 투자할 수 있는 시간", type: "radio", required: true, enabled: true, order: 5, section: "demographics", options: ["1시간 미만", "1 ~ 2시간", "2 ~ 4시간", "4시간 이상"] },
  { key: "channel", label: "머니업클래스를 알게 되신 경로는?", type: "radio", required: true, enabled: true, order: 6, section: "demographics", options: ["인터넷 직접 검색", "지인 추천", "SNS(유튜브, 인스타, 메시지류)", "마케팅 광고", "핸드폰 문자, 카톡", "기타"] },
];

const PRE_CONTENT_FIELDS: FormField[] = [
  { key: "selectReason", label: "강사님 강의를 선택하신 이유가 어떻게 되시나요?", type: "textarea", required: true, enabled: true, order: 10, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "computer", label: "나의 컴퓨터 활용 능력은?", type: "scale", required: true, enabled: true, order: 11, section: "freetext", scaleMin: 1, scaleMax: 10 },
  { key: "prevCourse", label: "머니업클래스의 다른 정규강의를 수강하신 적이 있나요? (있다면 어떤 강의를 수강하셨나요?)", type: "textarea", required: true, enabled: true, order: 12, section: "freetext", placeholder: "없으시다면 '없음'이라고 적어주세요" },
  { key: "prevExperience", label: "이전에 타 플랫폼의 강의 수강하신 경험이 있으신가요?", type: "radio", required: true, enabled: true, order: 13, section: "freetext", multiple: true, options: ["이 강의가 처음입니다", "유튜브", "블로그", "인스타그램", "쇼핑몰(쿠팡, 스마트스토어 등)", "기타"] },
  { key: "goal", label: "이번 강의를 듣고 벌고 싶은 월 수익 목표 금액?", type: "radio", required: true, enabled: true, order: 14, section: "freetext", options: ["월 100만원 정도 부수익", "월 300만원 정도 부수익", "월 500만원 정도 부수익", "월 1000만원 이상을 넘은 사업화"] },
  { key: "expectedBenefit", label: "이번 강의 혜택 중 가장 필요한(기대되는) 혜택은 무엇인가요?", type: "radio", required: true, enabled: true, order: 15, section: "freetext", multiple: true, options: ["강의 커리큘럼 및 콘텐츠", "강사님의 1:1 피드백", "실습 자료 및 템플릿 제공", "수강생 커뮤니티", "수료 후 지속 지원", "기타"] },
  { key: "hopePlatform", label: "이번 강의 수강 전, 머니업클래스에 바라는 점이 있으신가요?", type: "textarea", required: true, enabled: true, order: 16, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "hopeInstructor", label: "이번 강의 수강 전 걱정되시는 점이나 강사님에게 바라는 점이 있으신가요?", type: "textarea", required: true, enabled: true, order: 17, section: "freetext", placeholder: "자유롭게 작성해주세요" },
];

const POST_SCORE_FIELDS: FormField[] = [
  { key: "pSat", label: "수강 과정 중 가장 만족스러웠던 점", type: "radio", required: true, enabled: true, order: 10, section: "scores", multiple: true, options: ["강의 내용", "강사님의 피드백", "머니업클래스측 문의 응대", "기타"] },
  { key: "satOther", label: "1번 질문에서 '기타'를 선택하셨다면 어떤 점이 만족스러웠나요?", type: "textarea", required: false, enabled: true, order: 11, section: "scores", placeholder: "기타 의견을 적어주세요" },
  { key: "ps1", label: "전반적인 강의 커리큘럼 만족도는 몇 점이었나요?", type: "scale", required: true, enabled: true, order: 12, section: "scores", scaleMin: 1, scaleMax: 5 },
  { key: "lowScoreReason", label: "만약 5점 이하라면 이유는 무엇인가요?", type: "textarea", required: false, enabled: true, order: 13, section: "scores", placeholder: "아쉬웠던 점을 적어주세요" },
  { key: "ps2", label: "강사님의 피드백은 적절히 이루어졌나요?", type: "scale", required: true, enabled: true, order: 14, section: "scores", scaleMin: 1, scaleMax: 5 },
  { key: "lowFeedbackRequest", label: "만약 2점 이하라면 강의 과정 중 바라는 점을 말씀해주세요.", type: "textarea", required: true, enabled: true, order: 15, section: "scores", placeholder: "개선 바라는 점을 적어주세요" },
  { key: "pFmt", label: "선호하는 강의 방식은 무엇인가요?", type: "radio", required: true, enabled: true, order: 16, section: "scores", multiple: true, options: ["오프라인 현장 강의 (장점: 실시간 소통이 원활함, 단점: 정해진 시간에 일정 조정이 필요함)", "온라인 줌 라이브 (장점: 편하게 수강과 소통이 가능함, 단점: 인터넷 환경에 따라 진행이 원활하지 않을 수 있음)", "온라인 VOD (장점: 깔끔한 녹화 영상으로 언제 어디서든 편하게 수강이 가능함, 단점: 실시간으로 소통하기 어려움)", "기타"] },
];

const POST_FREETEXT_FIELDS: FormField[] = [
  { key: "pFree", label: "이번 강의 수강 후, 머니업클래스에 하고 싶은 말씀을 편하게 적어주세요.", type: "textarea", required: true, enabled: true, order: 20, section: "freetext", placeholder: "자유롭게 작성해주세요" },
  { key: "pRec", label: "이 강의를 지인분들께 추천하실 것 같으신가요?", type: "textarea", required: true, enabled: true, order: 21, section: "freetext", placeholder: "자유롭게 작성해주세요" },
];

const CONSENT_FIELDS: FormField[] = [
  {
    key: "privacyConsent",
    label: "개인정보 수집 및 이용 동의",
    type: "consent",
    required: true,
    enabled: true,
    order: 99,
    section: "freetext",
    consentConfig: {
      collectItems: "이름, 연락처",
      collectPurpose: "강의 수강 관리 및 안내",
      collectRetention: "강의 종료 후 1개월 보관",
    },
  },
];

export const PRE_SURVEY_DEFAULTS: FormField[] = [
  ...DEMOGRAPHICS_FIELDS,
  ...PRE_CONTENT_FIELDS,
  ...CONSENT_FIELDS,
];

export const POST_SURVEY_DEFAULTS: FormField[] = [
  ...POST_SCORE_FIELDS,
  ...POST_FREETEXT_FIELDS,
];

// ===== 커스텀 디폴트 (localStorage 저장) =====

const STORAGE_KEY_PRE = "survey_defaults_pre";
const STORAGE_KEY_POST = "survey_defaults_post";

export function getPreDefaults(): FormField[] {
  if (typeof window === "undefined") return PRE_SURVEY_DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PRE);
    if (saved) return JSON.parse(saved);
  } catch {}
  return PRE_SURVEY_DEFAULTS.map((f) => ({ ...f }));
}

export function getPostDefaults(): FormField[] {
  if (typeof window === "undefined") return POST_SURVEY_DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_POST);
    if (saved) return JSON.parse(saved);
  } catch {}
  return POST_SURVEY_DEFAULTS.map((f) => ({ ...f }));
}

export function savePreDefaults(fields: FormField[]) {
  localStorage.setItem(STORAGE_KEY_PRE, JSON.stringify(fields));
}

export function savePostDefaults(fields: FormField[]) {
  localStorage.setItem(STORAGE_KEY_POST, JSON.stringify(fields));
}

export function resetDefaults(type: "사전" | "후기") {
  if (type === "사전") localStorage.removeItem(STORAGE_KEY_PRE);
  else localStorage.removeItem(STORAGE_KEY_POST);
}

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
