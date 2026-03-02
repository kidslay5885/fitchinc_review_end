import type { Instructor } from "./types";

export interface FilenameParsed {
  platform: string;
  instructor: string;
  course: string;
  cohort: string;
  type: "사전" | "후기";
}

// Platform prefixes to strip
const PLATFORM_PREFIXES = ["핏크닉", "머니업클래스"] as const;

// Instructor alias mapping: short/variant name → canonical name
const INSTRUCTOR_ALIASES: Record<string, string> = {
  "선한부자": "선한부자오가닉",
  "오가닉": "선한부자오가닉",
};

/**
 * Parse filename to extract platform, instructor, cohort, and survey type.
 *
 * Real filename patterns (90+ files):
 *   핏크닉 민대표 1기 수강생 사전설문지.xlsx
 *   핏크닉 민대표 AI 버티컬 커머스 프로젝트(1기) 수강생 후기 설문지.xlsx
 *   핏크닉 제이온리_렛츠윤 SNS 수익화 마스터 클래스(2기) 수강생 후기 설문지.xlsx
 *   핏크닉 김놀부님 푸드릴스 4기 수강생 사전설문지.xlsx
 *   핏크닉 민대표님1기 수강생 후기 설문지.xlsx
 *   머니업클래스 돈버는형님들 AI 쇼핑몰 수익화 클래스 3기 수강생 사전설문지.xlsx
 *   머니업클래스 셀팜AI숏폼 2기 수강생 사전설문지.xlsx
 *   머니업클래스 선한부자 오가닉 AI애드센스1기 수강생 사전설문지.xlsx
 *
 * Rule: The token immediately after the platform name is ALWAYS the instructor name.
 */
export function parseFilename(
  filename: string,
  existingInstructors: Instructor[] = []
): FilenameParsed {
  const n = filename.replace(/\.(csv|xlsx?)$/i, "").replace(/!+$/, "").trim();

  // --- Platform ---
  let platform = "";
  let rest = n;
  for (const prefix of PLATFORM_PREFIXES) {
    if (n.startsWith(prefix)) {
      platform = prefix;
      rest = n.slice(prefix.length).trim();
      break;
    }
  }

  // --- Survey type ---
  let type: "사전" | "후기" = "사전";
  if (/후기|만족도|피드백|post/i.test(n)) type = "후기";

  // --- Cohort number ---
  // Match patterns: (1기), 1기, (1 기), 1 기
  let cohort = "";
  const cohortMatch = n.match(/[(\s]?(\d+)\s*기/);
  if (cohortMatch) cohort = cohortMatch[1] + "기";

  // 기수를 못 찾으면 빈 문자열 → 업로드 시 사용자가 직접 입력

  // --- Instructor name ---
  let instructor = "";

  // Strategy 1: Check if any existing instructor name appears in the filename
  // Sort by name length descending to prefer longer matches (e.g., "선한부자오가닉" over "선한부자")
  // Use space-insensitive matching: remove all spaces before comparing
  const existingNames = existingInstructors
    .map((i) => i.name)
    .sort((a, b) => b.length - a.length);

  const restNoSpace = rest.replace(/\s/g, "");
  for (const name of existingNames) {
    const nameNoSpace = name.replace(/\s/g, "");
    if (restNoSpace.includes(nameNoSpace)) {
      instructor = name;
      break;
    }
  }

  // Strategy 2: Positional extraction — first token after platform name
  if (!instructor && rest) {
    // Handle cases like "셀팜AI숏폼" where instructor is glued to class name
    // or "민대표님1기" where 님 + number is glued
    // Split on spaces first
    const tokens = rest.split(/\s+/);
    if (tokens.length > 0) {
      let firstToken = tokens[0];

      // Strip trailing "님" ONLY when followed by digits/기 or end of token
      // "김놀부님" → "김놀부", "민대표님1기" → "민대표"
      // BUT keep "돈버는형님들" intact (님 followed by 들)
      firstToken = firstToken.replace(/님(\d|$)/, "$1");
      // Also strip standalone trailing "님"
      if (firstToken.endsWith("님")) {
        firstToken = firstToken.slice(0, -1);
      }

      // Strip trailing possessive "의" (e.g., "부자꿈틀의" → "부자꿈틀")
      if (firstToken.endsWith("의") && firstToken.length > 2) {
        firstToken = firstToken.slice(0, -1);
      }

      // Strip trailing "AI..." class description glued without space
      // e.g., "셀팜AI숏폼" → "셀팜", "선한부자오가닉" stays as-is (no AI prefix)
      const aiSplit = firstToken.match(/^(.+?)(AI.*)$/);
      if (aiSplit && aiSplit[1].length >= 2) {
        firstToken = aiSplit[1];
      }

      // Strip trailing digits+기 glued without space
      // e.g., "디선제압4기" → "디선제압"
      firstToken = firstToken.replace(/\d+기.*$/, "");

      if (firstToken.length >= 2) {
        instructor = firstToken;
      }
    }
  }

  // Apply instructor alias mapping
  if (INSTRUCTOR_ALIASES[instructor]) {
    instructor = INSTRUCTOR_ALIASES[instructor];
  }

  // --- Course name ---
  // 강사명과 기수 마커 사이의 텍스트를 강의명으로 추출
  // 예: "핏크닉 셀링남 AI 브랜드 파이프 시크릿 로드맵(1기) 수강생 후기 설문지"
  //   → course = "AI 브랜드 파이프 시크릿 로드맵"
  let course = "";
  if (instructor && rest) {
    // rest에서 강사명 이후 부분 추출
    const instNoSpace = instructor.replace(/\s/g, "");
    const restNoSpaceForCourse = rest.replace(/\s/g, "");
    const instEndIdx = restNoSpaceForCourse.indexOf(instNoSpace);

    if (instEndIdx >= 0) {
      // 원본 rest에서 강사명 이후 텍스트를 찾기
      // 공백 포함 원본에서 강사명 뒤의 위치를 찾음
      let charCount = 0;
      let origIdx = 0;
      const targetCount = instEndIdx + instNoSpace.length;
      for (let j = 0; j < rest.length && charCount < targetCount; j++) {
        if (rest[j] !== " " && rest[j] !== "\t") charCount++;
        origIdx = j + 1;
      }
      const afterInst = rest.slice(origIdx).trim();

      // "님" 접미사 제거
      const afterInstClean = afterInst.replace(/^님\s*/, "");

      // 기수 마커(N기) 또는 "(N기)" 앞까지의 텍스트를 강의명으로
      // "AI 브랜드 파이프 시크릿 로드맵(1기) 수강생 후기 설문지"
      // → "AI 브랜드 파이프 시크릿 로드맵"
      const courseMatch = afterInstClean.match(/^(.+?)[\s(]*\d+\s*기/);
      if (courseMatch) {
        let courseName = courseMatch[1].trim();
        // "수강생", "설문지" 등의 후기/사전 관련 단어 제거
        courseName = courseName.replace(/\s*(수강생|설문지|사전|후기|만족도|피드백|post)\s*/gi, " ").trim();
        // 끝에 남은 괄호/공백 제거
        courseName = courseName.replace(/[(\s]+$/, "").trim();
        // 닫히지 않은 괄호 제거: "AI 시니어 라디오(유튜브" → "AI 시니어 라디오"
        courseName = courseName.replace(/\([^)]*$/, "").trim();
        if (courseName.length >= 2) {
          course = courseName;
        }
      }
    }
  }

  return { platform, instructor, course, cohort, type };
}
