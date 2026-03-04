// ===== Supabase DB 타입 =====

export interface Survey {
  id: string;
  filename: string;
  platform: string | null;
  instructor: string | null;
  course: string | null;
  cohort: string | null;
  survey_type: "사전" | "후기";
  status: "uploaded" | "analyzed" | "classified";
  response_count: number;
  pm: string;
  start_date: string | null;
  end_date: string | null;
  total_students: number;
  created_at: string;
}

export interface Comment {
  id: string;
  survey_id: string;
  respondent: string;
  original_text: string;
  sentiment: "positive" | "negative" | "neutral" | null;
  ai_summary: string | null;
  source_field: string;
  tag: "platform_pm" | "platform_pd" | "platform_cs" | "platform_general" | "platform_etc" | "instructor" | null;
  ai_classified?: boolean;
  created_at: string;
}

export interface ShareLink {
  id: string;
  token: string;
  title: string;
  share_type: "comments" | "instructor";
  filter_platform: string | null;
  filter_instructor: string | null;
  filter_cohort: string | null;
  filter_course: string | null;
  filter_sentiment: string | null;
  created_at: string;
  expires_at: string | null;
}

// ===== 클라이언트 앱 타입 (원래 UI용) =====

export interface SurveyResponse {
  id: string;
  name: string;
  gender: string;
  age: string;
  job: string;
  hours: string;
  channel: string;
  computer: number;
  goal: string;
  hopePlatform: string;
  hopeInstructor: string;
  ps1: number;
  ps2: number;
  pSat: string;
  pFmt: string;
  pFree: string;
  pRec: string;
  rawData: Record<string, string>;
}

export interface Cohort {
  id: string;
  label: string;
  pm: string;
  date: string;
  endDate: string;
  totalStudents: number;
  preResponses: SurveyResponse[];
  postResponses: SurveyResponse[];
  /** 사전설문 업로드 여부 (0건이라도 true) */
  hasPreSurvey?: boolean;
  /** 후기설문 업로드 여부 (0건이라도 true) */
  hasPostSurvey?: boolean;
  /** hierarchy에서 받은 응답 수 (lazy load 전 표시용) */
  preCount?: number;
  postCount?: number;
  /** responses API 호출 완료 여부 */
  dataLoaded?: boolean;
}

export interface Course {
  id: string;
  name: string;
  cohorts: Cohort[];
}

export interface Instructor {
  id: string;
  name: string;
  category: string;
  photo: string;
  photoPosition: string;
  courses: Course[];
}

/** 강사의 모든 기수를 courses에서 flat하게 반환 */
export function allCohorts(inst: Instructor): Cohort[] {
  return (inst.courses || []).flatMap((c) => c.cohorts || []);
}

export interface Platform {
  id: string;
  name: string;
  instructors: Instructor[];
}

export interface ComplaintItem {
  theme: string;
  count: number;
  who: string[];
  detail: string;
}

export interface SuggestionItem {
  from: string;
  text: string;
}

export interface StrengthItem {
  title: string;
  responses: { name: string; text: string }[];
}

export interface AnalysisResult {
  complaints: ComplaintItem[];
  suggestions: SuggestionItem[];
  strengths: StrengthItem[];
}

export interface ParsedFile {
  file: File;
  name: string;
  platform: string;
  inst: string;
  course: string;
  cohort: string;
  type: "사전" | "후기";
}

// ===== API 요청/응답 타입 =====

export interface UploadResult {
  survey: Survey;
  commentCount: number;
  responseCount: number;
}

export interface AnalyzeResult {
  index: number;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
}

// ===== 헬퍼 함수 =====

export function autoStatus(c: Cohort): "완료" | "진행중" | "준비중" {
  if (c.hasPostSurvey || c.postResponses.length > 0) return "완료";
  if (c.hasPreSurvey || c.preResponses.length > 0) return "진행중";
  return "준비중";
}

export function statusColor(s: string): string {
  if (s === "완료") return "text-emerald-600";
  if (s === "진행중") return "text-amber-600";
  return "text-muted-foreground";
}

export function statusBg(s: string): string {
  if (s === "완료") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "진행중") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

/** 10점 만점 기준으로 반환 (개별 응답마다 환산 후 평균) */
export function cohortAvgScore(c: Cohort): number {
  if (c.postResponses.length === 0) return 0;
  const to10 = (v: number) => (v <= 5 ? Math.min(10, v * 2) : Math.min(10, v));
  const total = c.postResponses.reduce((a, r) => {
    const s1 = r.ps1 > 0 ? to10(r.ps1) : 0;
    const s2 = r.ps2 > 0 ? to10(r.ps2) : 0;
    const cnt = (r.ps1 > 0 ? 1 : 0) + (r.ps2 > 0 ? 1 : 0);
    return a + (cnt > 0 ? (s1 + s2) / cnt : 0);
  }, 0);
  const withScore = c.postResponses.filter((r) => r.ps1 > 0 || r.ps2 > 0).length;
  if (withScore === 0) return 0;
  return Math.round((total / withScore) * 100) / 100;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
