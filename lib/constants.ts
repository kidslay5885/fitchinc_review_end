import type { Platform } from "./types";

export const DEFAULT_PLATFORMS: Platform[] = [
  { id: "p1", name: "핏크닉", instructors: [] },
  { id: "p2", name: "머니업클래스", instructors: [] },
];

export const KNOWN_INSTRUCTORS: Record<string, string[]> = {
  핏크닉: ["민대표", "김작가", "이쇼츠", "킴브로", "윙스"],
  머니업클래스: ["셀팜", "머니테이커", "킴브로", "윙스"],
};

// 네이버 폼 등 설문 엑셀 컬럼명 매칭 (정규식)
export const COLUMN_PATTERNS: Record<string, RegExp> = {
  name: /수강생.*이름|이름|성명|성함|응답자/i,
  gender: /성별/i,
  age: /연령|나이/i,
  job: /하고.*계신.*일|직업|직종/i,
  hours: /투자.*시간|부업.*시간/i,
  channel: /알게.*경로|경로.*알게|유입.*경로/i,
  computer: /컴퓨터.*활용|PC.*활용|활용.*능력/i,
  goal: /벌고.*싶은.*수익|목표.*수익|수익.*목표|목표.*금액/i,
  selectReason: /강사님.*강의를.*선택|선택하신.*이유|강의.*선택.*이유/i,
  hopePlatform: /플랫폼에.*바라|핏크닉.*바라|머니업.*바라|플랫폼.*기대/i,
  hopeInstructor: /강사에게.*바라|강사.*바라|걱정.*강사|강사.*기대/i,
  satOther: /기타.*선택.*만족|기타.*어떤.*점|기타.*만족스러웠/i,
  pSat: /만족스러웠던.*점/i,
  ps1: /커리큘럼.*만족/i,
  ps2: /피드백.*적절|피드백.*이루어/i,
  pFmt: /선호.*방식|강의.*형태/i,
  pFree: /하고.*싶은.*말|편하게.*적어|자유.*의견|자유의견|추가.*의견/i,
  pRec: /추천.*지인|지인.*추천|추천하실/i,
  lowScoreReason: /2점.*이하.*이유|이하.*이유.*무엇|커리큘럼.*불만/i,
  lowFeedbackRequest: /5점.*이하.*바라는|이하.*바라는.*점|피드백.*개선/i,
  prevCourse: /다른.*정규강의|정규강의.*수강|핏크닉.*수강.*이력|머니업.*수강.*이력/i,
  prevExperience: /타.*플랫폼.*수강|다른.*플랫폼.*경험|수강.*경험/i,
  expectedBenefit: /기대되는.*혜택|혜택.*기대|강의.*혜택/i,
};

export const PLATFORM_NAMES = ["핏크닉", "머니업클래스"] as const;
