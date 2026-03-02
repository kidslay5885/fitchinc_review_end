/**
 * 강사별 강의명 레지스트리
 *
 * 파일 업로드 시 파일명에서 추출된 강사+플랫폼 정보로
 * 정확한 강의명을 매칭합니다.
 *
 * - 강사+플랫폼에 강의가 1개 → 자동 배정
 * - 강사+플랫폼에 강의가 2개+ → keywords로 파일명 매칭
 *
 * ⚠️ schedule-data.ts 기준으로 검증됨 (2026-03-02)
 *    기수마다 강의명이 바뀌는 강사는 등록하지 않음
 *    → 업로드 시 "기존 강의 제안" 기능으로 대체
 */

export interface CourseEntry {
  instructor: string;
  platform: string;
  course: string;
  /** 같은 강사+플랫폼에 강의가 여러 개일 때 파일명 매칭용 키워드 */
  keywords?: string[];
}

const COURSE_REGISTRY: CourseEntry[] = [
  // ── 핏크닉 ── (강의명이 기수에 걸쳐 일관된 강사만)
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
  { instructor: "온백", platform: "핏크닉", course: "AI 브랜드 커넥터 실전클래스" },
  { instructor: "온물주", platform: "핏크닉", course: "1000만원 달성 챌린지 AI 쿠팡 끝판왕 클래스" },
  { instructor: "정쌤", platform: "핏크닉", course: "AI 로켓그로스 안전마진 로드맵" },
  { instructor: "김놀부", platform: "핏크닉", course: "푸드릴스 수익화 프로젝트" },
  { instructor: "지인옥", platform: "핏크닉", course: "AI 롱폼 유튜브 수익화" },
  { instructor: "이디", platform: "핏크닉", course: "AI 상세페이지 클래스" },
  { instructor: "파이스터디", platform: "핏크닉", course: "월 300 AI 쇼핑몰 대량등록 클래스" },

  // ── 머니업클래스 ── (강의명이 기수에 걸쳐 일관된 강사만)
  { instructor: "돈버는형님들", platform: "머니업클래스", course: "AI 쇼핑몰 수익화 클래스" },
  { instructor: "셀링남", platform: "머니업클래스", course: "AI 브랜드 파이프 시크릿 로드맵" },
  { instructor: "페이지부스터", platform: "머니업클래스", course: "AI 상세페이지 마스터 클래스" },
  { instructor: "싸다구셀러", platform: "머니업클래스", course: "쇼핑 라이브 수익화 클래스" },
  { instructor: "위그로", platform: "머니업클래스", course: "AI 쿠팡 올인원 패키지" },
  { instructor: "플로이쨈", platform: "머니업클래스", course: "AI 공장으로 월 2천 유튜브 수익 자동화" },
  { instructor: "선한부자오가닉", platform: "머니업클래스", course: "AI 애드센스 올인원클래스" },

  // ── 부스트머니랩 ──
  { instructor: "선한부자오가닉", platform: "부스트머니랩", course: "AI 애드센스 올인원클래스" },

  // ── 제외된 강사 (기수마다 강의명이 달라 레지스트리 매칭 불가) ──
  // 윙스(핏크닉): 1기 "AI 유튜브 숏폼,롱폼 올인원 코스" / 2기 "시니어 타겟..." / 3기 "월 1000..."
  // 셀팜(머니업): 2기 "AI 숏폼..." / 3-4기 "AI 유튜브..." / 5기 "AI 롱폼..."
  // 유메이커(머니업): 1기 "AI 유튜브 비밀공식" / 2기 "AI유튜브 비밀 수익화 공식"
  // 제이온리_렛츠윤(핏크닉): 1기 "SNS 수익화 마스터 클래스" / 2기 "월급 5배 SNS 수익화 마스터"
  // → 이 강사들은 업로드 시 "기존 강의 제안" 버튼으로 대체
];

/**
 * 강사명 + 플랫폼 + 파일명으로 올바른 강의명을 찾습니다.
 *
 * 1. (instructor, platform) 조합으로 레지스트리 검색
 * 2. 결과 1개 → 해당 강의명 반환
 * 3. 결과 2개+ → 파일명에서 keywords 매칭으로 선택
 * 4. 매칭 실패 → 빈 문자열 반환
 */
export function resolveCourse(
  instructor: string,
  platform: string,
  filename: string = ""
): string {
  // 정확한 (instructor, platform) 매칭
  let matches = COURSE_REGISTRY.filter(
    (e) => e.instructor === instructor && e.platform === platform
  );

  // platform 빈 문자열인 항목도 포함 (플랫폼 미지정 강의)
  if (matches.length === 0) {
    matches = COURSE_REGISTRY.filter(
      (e) => e.instructor === instructor && e.platform === ""
    );
  }

  if (matches.length === 0) return "";
  if (matches.length === 1) return matches[0].course;

  // 여러 강의 → keywords로 파일명 매칭
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

/** 레지스트리의 모든 항목을 반환 (관리 UI 등에서 사용) */
export function getAllCourseEntries(): CourseEntry[] {
  return [...COURSE_REGISTRY];
}
