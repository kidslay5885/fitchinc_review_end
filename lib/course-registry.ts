/**
 * Course name registry per instructor
 *
 * Maps instructor + platform to a canonical course name during upload.
 *
 * - Single match for (instructor, platform) -> auto-assign
 * - Multiple matches -> keyword matching against filename
 *
 * Updated 2026-09-10 based on schedule spreadsheet data.
 */

export interface CourseEntry {
  instructor: string;
  platform: string;
  course: string;
  /** Keyword matching when multiple courses exist for same instructor+platform */
  keywords?: string[];
}

const COURSE_REGISTRY: CourseEntry[] = [
  // ── 핏크닉 ──

  { instructor: "거투", platform: "핏크닉", course: "AI 소액경매 프로젝트" },
  { instructor: "건물의신", platform: "핏크닉", course: "매달 300 자동월세 시스템", keywords: ["월세", "자동"] },
  { instructor: "건물의신", platform: "핏크닉", course: "부동산 단타 세팅 프로젝트", keywords: ["단타", "부동산"] },
  { instructor: "김놀부", platform: "핏크닉", course: "푸드릴스 수익화 프로젝트" },
  { instructor: "노마드로빅", platform: "핏크닉", course: "AI 애드센스 수익화 프로젝트" },
  { instructor: "다나", platform: "핏크닉", course: "월 2천 건강식품 매출 공식" },
  { instructor: "디선제압", platform: "핏크닉", course: "월 300 AI 상세페이지 프로젝트" },
  { instructor: "러셀", platform: "핏크닉", course: "RDX" },
  { instructor: "머니테이커", platform: "핏크닉", course: "파이널VIP 코스" },
  { instructor: "민대표", platform: "핏크닉", course: "AI 버티컬 커머스 프로젝트" },
  { instructor: "부자꿈틀", platform: "핏크닉", course: "과일위탁 수익 클래스", keywords: ["과일", "위탁"] },
  { instructor: "부자꿈틀", platform: "핏크닉", course: "AI숏폼 월급 3배 수익화 프로젝트", keywords: ["숏폼", "숏", "AI숏"] },
  { instructor: "셀링남", platform: "핏크닉", course: "AI 로켓그로스 올인원 클래스", keywords: ["로켓", "그로스"] },
  { instructor: "셀링남", platform: "핏크닉", course: "AI 브랜드 파이프 시크릿 로드맵", keywords: ["브랜드", "파이프"] },
  { instructor: "셀링남", platform: "핏크닉", course: "쿠팡 무경쟁 소싱법 클래스", keywords: ["쿠팡", "무경쟁", "소싱"] },
  { instructor: "셀팜", platform: "핏크닉", course: "쿠팡 농수산물 시크릿 코스", keywords: ["쿠팡", "농수산"] },
  { instructor: "셀팜", platform: "핏크닉", course: "월 300 AI 유튜브 연금", keywords: ["유튜브", "연금"] },
  { instructor: "셀팜", platform: "핏크닉", course: "AI 숏폼 수익화 프로젝트", keywords: ["숏폼"] },
  { instructor: "알렉스쌤", platform: "핏크닉", course: "블루오션 한국어 과외" },
  { instructor: "온백", platform: "핏크닉", course: "AI 브랜드 커넥터 실전클래스" },
  { instructor: "온물주", platform: "핏크닉", course: "1000만원 달성 챌린지 AI 쿠팡 끝판왕 클래스" },
  // Wings Fitchnic: all cohorts grouped under one canonical name
  { instructor: "윙스", platform: "핏크닉", course: "AI 롱폼 유튜브" },
  { instructor: "이디", platform: "핏크닉", course: "AI 상세페이지 클래스" },
  { instructor: "정쌤", platform: "핏크닉", course: "AI 로켓그로스 안전마진 로드맵" },
  { instructor: "제이온리_렛츠윤", platform: "핏크닉", course: "SNS 수익화 마스터" },
  { instructor: "지인옥", platform: "핏크닉", course: "AI 롱폼 유튜브 수익화" },
  { instructor: "코사장", platform: "핏크닉", course: "AI 코스트코 브랜드 수익화" },
  { instructor: "틱톡하니", platform: "핏크닉", course: "AI 블루오션 틱톡 커머스" },
  { instructor: "파이스터디", platform: "핏크닉", course: "월 300 AI 쇼핑몰 대량등록 클래스" },

  // ── 머니업클래스 ──

  { instructor: "둘리엄마", platform: "머니업클래스", course: "AI 쇼츠 백화점 프로젝트" },
  { instructor: "돈버는형님들", platform: "머니업클래스", course: "AI 쇼핑몰 수익화 클래스" },
  { instructor: "리셀이코치", platform: "머니업클래스", course: "AI 아마존 자동 수익화 비밀공식" },
  { instructor: "민대표", platform: "머니업클래스", course: "버티컬 커머스 프로젝트" },
  { instructor: "부하루", platform: "머니업클래스", course: "블로그 커넥팅 수익화 프로젝트" },
  { instructor: "셀링남", platform: "머니업클래스", course: "AI 브랜드 파이프 시크릿 로드맵" },
  { instructor: "승리쌤", platform: "머니업클래스", course: "월300 연예인 유튜브 쇼츠" },
  { instructor: "싸다구셀러", platform: "머니업클래스", course: "쇼핑 라이브 수익화 클래스" },
  { instructor: "엄필승", platform: "머니업클래스", course: "100% 자동화 위탁판매의 실체" },
  { instructor: "위그로", platform: "머니업클래스", course: "AI 쿠팡 올인원 패키지" },
  // Wings MoneyUp: shopping shorts grouped, detail page separate
  { instructor: "윙스", platform: "머니업클래스", course: "AI 쇼핑숏폼", keywords: ["숏폼", "쇼핑", "딸깍"] },
  { instructor: "윙스", platform: "머니업클래스", course: "AI로 월급버는 상세페이지 프로젝트", keywords: ["상세페이지", "월급"] },
  { instructor: "이피디", platform: "머니업클래스", course: "월300 시니어 일기장 유튜브" },
  { instructor: "카르", platform: "머니업클래스", course: "2주 실행 AI 과일위탁판매" },
  { instructor: "틱톡하니", platform: "머니업클래스", course: "AI 블루오션 틱톡 커머스" },
  { instructor: "페이지부스터", platform: "머니업클래스", course: "AI 상세페이지 마스터 클래스" },
  { instructor: "플로이쨈", platform: "머니업클래스", course: "AI 공장으로 월 2천 유튜브 수익 자동화" },
  { instructor: "하니쌤", platform: "머니업클래스", course: "마진 45% 월3천 건강식품 특강" },
  { instructor: "선한부자오가닉", platform: "머니업클래스", course: "AI 애드센스 올인원클래스" },

  // ── 부스트머니랩 ──
  { instructor: "선한부자오가닉", platform: "부스트머니랩", course: "AI 애드센스 올인원클래스" },

  // ── Not registered (variable course names per cohort, kept as-is) ──
  // SellFarm (MoneyUp): 3-4기 "AI 유튜브 수익화 프로젝트" / 5기 "AI 롱폼 애니메이션" / 6-7기 "월300 AI 경제 유튜브"
  // YouTuber (MoneyUp): 1기 "AI 유튜브 비밀공식" / 2기 "AI유튜브 비밀 수익화 공식" / 3기 "급상승 비밀공식" / 4기 "AI 이슈 숏폼 비밀공식"
  // -> These use filename-parsed course names directly
];

/**
 * Resolve canonical course name from instructor + platform + filename.
 *
 * 1. Match (instructor, platform) in registry
 * 2. Single match -> return its course name
 * 3. Multiple matches -> keyword matching against filename
 * 4. No match -> return empty string (falls through to filename parser)
 */
export function resolveCourse(
  instructor: string,
  platform: string,
  filename: string = ""
): string {
  // Exact (instructor, platform) match
  let matches = COURSE_REGISTRY.filter(
    (e) => e.instructor === instructor && e.platform === platform
  );

  // Fallback: platform-agnostic entries
  if (matches.length === 0) {
    matches = COURSE_REGISTRY.filter(
      (e) => e.instructor === instructor && e.platform === ""
    );
  }

  if (matches.length === 0) return "";
  if (matches.length === 1) return matches[0].course;

  // Multiple courses -> keyword matching
  const fnNorm = filename.replace(/\s/g, "").toLowerCase();
  let bestMatch = matches[0];
  let bestScore = 0;

  for (const entry of matches) {
    if (!entry.keywords || entry.keywords.length === 0) continue;
    let score = 0;
    for (const kw of entry.keywords) {
      if (fnNorm.includes(kw.replace(/\s/g, "").toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch.course;
}

/** Return all registry entries */
export function getAllCourseEntries(): CourseEntry[] {
  return [...COURSE_REGISTRY];
}
