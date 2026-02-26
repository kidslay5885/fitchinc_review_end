import type { SurveyResponse, Cohort } from "./types";

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
  selectReason: Record<string, number>;
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
  const selectReason: Record<string, number> = {};
  const expectedBenefit: Record<string, number> = {};
  const computerDist: Record<number, number> = {};
  let computerSum = 0;
  let computerCount = 0;

  for (const r of responses) {
    if (r.gender) gender[r.gender] = (gender[r.gender] || 0) + 1;
    if (r.age) age[r.age] = (age[r.age] || 0) + 1;
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
      const pe = extractFromRawData(r.rawData, RAW_DATA_PATTERNS.prevExperience).trim();
      if (pe) prevExperience[pe] = (prevExperience[pe] || 0) + 1;

      const pc = extractFromRawData(r.rawData, RAW_DATA_PATTERNS.prevCourse).trim();
      if (pc) prevCourse[pc] = (prevCourse[pc] || 0) + 1;

      // selectReason: 복수 선택 가능 ("|" 구분자)
      const sr = extractFromRawData(r.rawData, RAW_DATA_PATTERNS.selectReason).trim();
      if (sr) {
        const parts = sr.split("|").map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          selectReason[p] = (selectReason[p] || 0) + 1;
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
    selectReason,
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
