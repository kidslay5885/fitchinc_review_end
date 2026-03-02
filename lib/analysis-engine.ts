import type { SurveyResponse, Cohort } from "./types";
import { COLUMN_PATTERNS } from "./constants";

// ---- 표준 필드 → 한국어 라벨 매핑 (설문 질문 목록용) ----
const STANDARD_LABELS: Record<string, string> = {
  name: "수강생 이름",
  gender: "성별",
  age: "연령대",
  job: "현재 하고 계신 일",
  hours: "하루에 부업에 투자할 수 있는 시간",
  channel: "알게 되신 경로",
  computer: "컴퓨터 활용 능력",
  goal: "목표 수익",
  pSat: "수강 과정 중 만족스러웠던 점",
  ps1: "전반적인 강의 커리큘럼 만족도",
  ps2: "강사님의 피드백 만족도",
  pFmt: "선호하는 강의 방식",
  pFree: "하고 싶은 말",
  pRec: "지인 추천 의향",
};

// ---- rawData 추출 패턴 ----
// XLSX 컬럼명에 매칭되지 않아 rawData에 보관된 필드를 패턴으로 추출
export const RAW_DATA_PATTERNS: Record<string, RegExp> = {
  prevExperience: /타.*플랫폼.*강의.*수강|이전.*플랫폼.*수강/i,
  prevCourse: /다른.*정규강의.*수강|다른.*정규.*강의.*수강|핏크닉.*정규/i,
  selectReason: /강의를.*선택.*이유|선택하신.*이유/i,
  expectedBenefit: /혜택.*기대|기대.*혜택|혜택.*필요/i,
  satOther: /기타.*선택.*어떤|기타.*만족/i,
};

/** rawData에서 패턴에 매칭되는 첫 번째 값 추출 */
export function extractFromRawData(rawData: Record<string, string>, pattern: RegExp): string {
  for (const [key, value] of Object.entries(rawData)) {
    if (pattern.test(key)) return value;
  }
  return "";
}

/** rawData에서 패턴에 매칭되는 원본 컬럼명(키) 추출 */
export function extractKeyFromRawData(rawData: Record<string, string>, pattern: RegExp): string {
  for (const key of Object.keys(rawData)) {
    if (pattern.test(key)) return key;
  }
  return "";
}

/** "없음" 계열 개별 단어 패턴 (정제 후 비교, 대소문자 무시) */
const NO_WORD = /^(없음|없습니다|없어요|없어여|아니요|아니오|아뇨|없어|없슴|없네요|없습니닷|없쓰빈다|해당없음|해당사항없음|해당없어요|모르겠|몰라요|모릅니다|없읒|없름|x|no|none|nope|-|\.+)$/i;

/** "처음/첫" 계열 — 수강 이력이 없다는 의미 */
const FIRST_TIME = /처음|첫\s*(수강|강의|번째)|이번이/;

/** "수강한 적 없음" 등 문장형 부정 표현 */
const NO_EXPERIENCE = /수강.{0,5}없|들은?.{0,5}없|경험.{0,5}없|안.{0,3}(들어|해\s?봤)|듣지/;

/** "기억 안 남" 등 기억 못하는 경우 — 실질적으로 수강 이력 불명 */
const NO_MEMORY = /기억.{0,3}(안|못|없)|모르겠|잘\s*모르|까먹|잊어/;

/** 의미 없는 짧은 응답 — "반반", "글쎄", "음" 등 */
const MEANINGLESS = /^(반반|글쎄|글세|음+|흠+|ㅇ|ㅡ|모름|몰라|잘|뭐|그냥)$/;

/** "없음" 응답 판별 — 특수문자 정제 + 다단계 필터 */
function isNegativeResponse(text: string): boolean {
  // 1) 특수문자 정제 (~, !, ?, ㅎㅋㅠ 등)
  const cleaned = text.replace(/[~!?…·ㅎㅋㅠㅜ^*#@'"()~！？]/g, "").trim();
  if (!cleaned) return true;

  // 2) "처음입니다", "첫 수강", "이번이 처음" 등
  if (FIRST_TIME.test(cleaned)) return true;

  // 3) "수강한 적 없음", "들은 적 없다" 등 문장형
  if (NO_EXPERIENCE.test(cleaned)) return true;

  // 4) "기억안납니다", "기억이 안 나요" 등
  if (NO_MEMORY.test(cleaned)) return true;

  // 5) "반반", "글쎄" 등 의미 없는 짧은 응답
  if (MEANINGLESS.test(cleaned)) return true;

  // 4) 단어별 분리 후 모두 "없음" 계열인지 체크
  const parts = cleaned.split(/[\s,.\/|]+/).filter(Boolean);
  return parts.length === 0 || parts.every((p) => NO_WORD.test(p));
}

export interface DemographicStats {
  gender: Record<string, number>;
  age: Record<string, number>;
  job: Record<string, number>;
  hours: Record<string, number>;
  computer: { avg: number; distribution: Record<number, number> };
  goal: Record<string, number>;
  channel: Record<string, number>;
  prevExperience: Record<string, number>;
  prevCourse: Record<string, number>;
  prevCourseDetails: string[];
  prevCourseNoDetails: string[];
  expectedBenefit: Record<string, number>;
}

export function computeDemographics(responses: SurveyResponse[]): DemographicStats {
  const gender: Record<string, number> = {};
  const age: Record<string, number> = {};
  const job: Record<string, number> = {};
  const hours: Record<string, number> = {};
  const goal: Record<string, number> = {};
  const channel: Record<string, number> = {};
  const prevExperience: Record<string, number> = {};
  const prevCourse: Record<string, number> = {};
  const prevCourseDetails: string[] = [];
  const prevCourseNoDetails: string[] = [];
  const expectedBenefit: Record<string, number> = {};
  const computerDist: Record<number, number> = {};
  let computerSum = 0;
  let computerCount = 0;

  for (const r of responses) {
    if (r.gender) gender[r.gender] = (gender[r.gender] || 0) + 1;
    if (r.age) {
      // "60대" → "60대 이상" 정규화 (차트 기본 카테고리와 일치)
      const ageKey = /^60대$/.test(r.age.trim()) ? "60대 이상" : r.age;
      age[ageKey] = (age[ageKey] || 0) + 1;
    }
    if (r.job) job[r.job] = (job[r.job] || 0) + 1;
    if (r.hours) hours[r.hours] = (hours[r.hours] || 0) + 1;
    if (r.goal) goal[r.goal] = (goal[r.goal] || 0) + 1;
    if (r.channel) channel[r.channel] = (channel[r.channel] || 0) + 1;
    if (r.computer > 0) {
      computerDist[r.computer] = (computerDist[r.computer] || 0) + 1;
      computerSum += r.computer;
      computerCount++;
    }

    // rawData에서 추가 필드 추출
    if (r.rawData) {
      // prevExperience: 복수 선택 가능 ("|" 구분자)
      const pe = extractFromRawData(r.rawData, RAW_DATA_PATTERNS.prevExperience).trim();
      if (pe) {
        const parts = pe.split("|").map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          prevExperience[p] = (prevExperience[p] || 0) + 1;
        }
      }

      // prevCourse: 자유 서술 → "있음"/"없음" 정규화
      const pc = extractFromRawData(r.rawData, RAW_DATA_PATTERNS.prevCourse).trim();
      if (pc) {
        if (isNegativeResponse(pc)) {
          prevCourse["없음"] = (prevCourse["없음"] || 0) + 1;
          prevCourseNoDetails.push(pc);
        } else {
          prevCourse["있음"] = (prevCourse["있음"] || 0) + 1;
          prevCourseDetails.push(pc);
        }
      }

      // expectedBenefit: 복수 선택 가능 ("|" 구분자)
      const eb = extractFromRawData(r.rawData, RAW_DATA_PATTERNS.expectedBenefit).trim();
      if (eb) {
        const parts = eb.split("|").map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          expectedBenefit[p] = (expectedBenefit[p] || 0) + 1;
        }
      }
    }
  }

  return {
    gender,
    age,
    job,
    hours,
    computer: {
      avg: computerCount > 0 ? Math.round((computerSum / computerCount) * 10) / 10 : 0,
      distribution: computerDist,
    },
    goal,
    channel,
    prevExperience,
    prevCourse,
    prevCourseDetails,
    prevCourseNoDetails,
    expectedBenefit,
  };
}

export interface ComputeScoresResult {
  ps1Avg: number;
  ps2Avg: number;
  recRate: number;
  ps1Excluded: boolean;
  ps2Excluded: boolean;
}

/** 10점 만점으로 통일 (원본이 5점 이하면 ×2, 초과면 그대로, 상한 10). 측정 불가 시 제외 플래그 */
export function computeScores(postResponses: SurveyResponse[]): ComputeScoresResult {
  if (postResponses.length === 0)
    return { ps1Avg: 0, ps2Avg: 0, recRate: 0, ps1Excluded: false, ps2Excluded: false };

  let ps1Sum = 0;
  let ps2Sum = 0;
  let recCount = 0;
  let ps1Count = 0;
  let ps2Count = 0;

  for (const r of postResponses) {
    if (r.ps1 > 0) {
      ps1Sum += r.ps1;
      ps1Count++;
    }
    if (r.ps2 > 0) {
      ps2Sum += r.ps2;
      ps2Count++;
    }
    if (/네|넵|추천|강추|할|싶/i.test(r.pRec)) recCount++;
  }

  const n = postResponses.length;
  const to10 = (raw: number) => (raw <= 5 ? Math.min(10, Math.round(raw * 2 * 100) / 100) : Math.min(10, Math.round(raw * 100) / 100));
  const rawPs1 = ps1Count > 0 ? ps1Sum / ps1Count : 0;
  const rawPs2 = ps2Count > 0 ? ps2Sum / ps2Count : 0;
  return {
    ps1Avg: to10(rawPs1),
    ps2Avg: to10(rawPs2),
    recRate: Math.round((recCount / n) * 1000) / 10,
    ps1Excluded: n > 0 && ps1Count === 0,
    ps2Excluded: n > 0 && ps2Count === 0,
  };
}

export function getTopStats(responses: SurveyResponse[]) {
  const stats = computeDemographics(responses);
  const total = responses.length;
  if (total === 0) return [];

  // Top goal
  const topGoal = Object.entries(stats.goal).sort((a, b) => b[1] - a[1])[0];
  // Top channel
  const topChannel = Object.entries(stats.channel).sort((a, b) => b[1] - a[1])[0];

  const result = [];
  if (topGoal) {
    result.push({
      label: "월 수익 목표 금액",
      desc: `최다 응답: ${topGoal[0]}`,
      num: `${Math.round((topGoal[1] / total) * 100)}%`,
      src: `${total}명 응답`,
    });
  }
  if (topChannel) {
    result.push({
      label: "알게 되신 경로",
      desc: `최다 응답: ${topChannel[0]}`,
      num: `${Math.round((topChannel[1] / total) * 100)}%`,
      src: `${total}명 응답`,
    });
  }
  result.push({
    label: "컴퓨터 활용 능력",
    desc: "나의 컴퓨터 활용 능력은?",
    num: `${stats.computer.avg}`,
    src: `${total}명 응답 · 10점 만점`,
  });

  return result;
}

export function getSatisfactionItems(postResponses: SurveyResponse[]) {
  const items: Record<string, number> = {};
  for (const r of postResponses) {
    if (!r.pSat) continue;
    const parts = r.pSat.split("|").map((s) => s.trim());
    for (const p of parts) {
      if (p) items[p] = (items[p] || 0) + 1;
    }
  }
  return Object.entries(items)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: postResponses.length > 0 ? Math.round((count / postResponses.length) * 1000) / 10 : 0,
    }));
}

export function aggregateInstructor(cohorts: Cohort[]) {
  let totalPre = 0;
  let totalPost = 0;
  const scores: number[] = [];

  for (const c of cohorts) {
    totalPre += c.preResponses.length;
    totalPost += c.postResponses.length;
    const avg = computeScores(c.postResponses);
    if (avg.ps1Avg > 0) scores.push((avg.ps1Avg + avg.ps2Avg) / 2);
  }

  const rawAvg =
    scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
  const avgScore = rawAvg <= 5 ? Math.min(10, rawAvg * 2) : Math.min(10, rawAvg);

  return { totalPre, totalPost, avgScore };
}

// ---- 동적 설문 질문 수집 ----

export interface ExtraQuestion {
  question: string;
  /** rawData 원본 키 (UI 표시에는 question, rawData 조회에는 rawKey 사용) */
  rawKey: string;
  summary: Record<string, number>;
  total: number;
}

/** 타임스탬프·이메일·동의·관리용 컬럼 스킵 */
const SKIP_COL = /^(타임스탬프|timestamp|제출\s*시간|수집\s*일시?|응답\s*일시?|이메일|email|e-?mail|접수\s*번호|참여자|번호|순번)$|개인\s*정보.*동의/i;

/**
 * rawData에서 COLUMN_PATTERNS·RAW_DATA_PATTERNS에 매칭되지 않는 "미매핑 질문"을 수집하여
 * 질문별 응답 분포를 반환한다.
 */
export function collectExtraQuestions(responses: SurveyResponse[]): ExtraQuestion[] {
  const rawPatterns = Object.values(RAW_DATA_PATTERNS);
  const colPatterns = Object.values(COLUMN_PATTERNS);

  const questionMap: Record<string, Record<string, number>> = {};

  for (const r of responses) {
    if (!r.rawData) continue;
    for (const [key, value] of Object.entries(r.rawData)) {
      if (!value || value.trim().length === 0) continue;
      const k = key.trim();
      if (SKIP_COL.test(k)) continue;
      if (rawPatterns.some((p) => p.test(k))) continue;
      if (colPatterns.some((p) => p.test(k))) continue;

      if (!questionMap[k]) questionMap[k] = {};
      const answer = value.trim();
      questionMap[k][answer] = (questionMap[k][answer] || 0) + 1;
    }
  }

  return Object.entries(questionMap)
    .map(([question, summary]) => ({
      question: question.replace(/\(\*\)\s*$/, "").trim(),
      rawKey: question,
      summary,
      total: Object.values(summary).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * 설문 응답 데이터에서 모든 질문(열 헤더)을 수집하여 리스트로 반환.
 * - 매핑된 표준 필드: 한국어 라벨로 대체 (실제 값이 있는 필드만)
 * - rawData 키: 원본 질문 텍스트 그대로 (SKIP_COL 제외)
 */
export function collectAllQuestions(responses: SurveyResponse[]): string[] {
  const questions: string[] = [];
  const usedFields = new Set<string>();

  // 1) 표준 필드: 응답에 실제 값이 있는 필드만 한국어 라벨로 추가
  for (const r of responses) {
    for (const [field, label] of Object.entries(STANDARD_LABELS)) {
      if (usedFields.has(field)) continue;
      const val = r[field as keyof SurveyResponse];
      if (val != null && String(val).trim() && String(val).trim() !== "0") {
        questions.push(label);
        usedFields.add(field);
      }
    }
  }

  // 2) rawData 키: 원본 질문 텍스트 (SKIP_COL 제외)
  const rawKeys = new Set<string>();
  for (const r of responses) {
    if (!r.rawData) continue;
    for (const key of Object.keys(r.rawData)) {
      const k = key.trim();
      if (SKIP_COL.test(k)) continue;
      rawKeys.add(k);
    }
  }
  for (const k of rawKeys) {
    questions.push(k.replace(/\(\*\)\s*$/, "").trim());
  }

  return questions;
}
