/**
 * 강사별 강의명 레지스트리
 *
 * 파일 업로드 시 파일명에서 추출된 강사+플랫폼 정보로
 * 정확한 강의명을 매칭합니다.
 *
 * - 강사+플랫폼에 강의가 1개 → 자동 배정
 * - 강사+플랫폼에 강의가 2개+ → keywords로 파일명 매칭
 */

export interface CourseEntry {
  instructor: string;
  platform: string;
  course: string;
  /** 같은 강사+플랫폼에 강의가 여러 개일 때 파일명 매칭용 키워드 */
  keywords?: string[];
}

const COURSE_REGISTRY: CourseEntry[] = [
  // ── 핏크닉 ──
  { instructor: "디선제압", platform: "핏크닉", course: "상세페이지 제작" },
  { instructor: "러셀", platform: "핏크닉", course: "AI 유튜브" },
  { instructor: "머니테이커", platform: "핏크닉", course: "광고대행" },
  { instructor: "민대표", platform: "핏크닉", course: "버티컬 커머스" },
  { instructor: "부자꿈틀", platform: "핏크닉", course: "과일위탁판매", keywords: ["과일", "위탁"] },
  { instructor: "부자꿈틀", platform: "핏크닉", course: "AI 숏폼", keywords: ["숏폼", "숏", "AI숏"] },
  { instructor: "부자꿈틀", platform: "핏크닉", course: "삼삼엠투", keywords: ["삼삼", "엠투", "M2"] },
  { instructor: "셀링남", platform: "핏크닉", course: "AI 로켓그로스", keywords: ["로켓", "그로스"] },
  { instructor: "셀링남", platform: "핏크닉", course: "AI 브랜드 파이프 시크릿 로드맵", keywords: ["브랜드", "파이프"] },
  { instructor: "셀팜", platform: "핏크닉", course: "틱톡 커머스", keywords: ["틱톡"] },
  { instructor: "셀팜", platform: "핏크닉", course: "쿠팡 농수산물", keywords: ["쿠팡", "농수산"] },
  { instructor: "온백", platform: "핏크닉", course: "AI 브랜드 커넥터" },
  { instructor: "윙스", platform: "핏크닉", course: "AI(상세페이지, 유튜브 쇼츠)" },
  { instructor: "정쌤", platform: "핏크닉", course: "AI 로켓그로스" },
  { instructor: "제이온리", platform: "핏크닉", course: "유튜브 쇼핑" },
  { instructor: "렛츠윤", platform: "핏크닉", course: "인스타 공구" },
  { instructor: "지인옥", platform: "핏크닉", course: "시니어롱폼" },
  { instructor: "노마드로빅", platform: "핏크닉", course: "구글 애드센스" },
  { instructor: "김놀부", platform: "핏크닉", course: "인스타 푸드릴스" },
  { instructor: "라이언", platform: "핏크닉", course: "소액 건물 투자" },
  { instructor: "빌딩형", platform: "핏크닉", course: "빌딩 투자" },
  { instructor: "온물주", platform: "핏크닉", course: "쿠팡 로켓그로스" },
  { instructor: "이지디자인", platform: "핏크닉", course: "AI 상세페이지" },

  // ── 머니업클래스 ──
  { instructor: "돈버는형님들", platform: "머니업클래스", course: "대량등록(쇼핑몰)" },
  { instructor: "셀링남", platform: "머니업클래스", course: "AI 브랜드 파이프 시크릿 로드맵" },
  { instructor: "셀팜", platform: "머니업클래스", course: "AI 숏폼" },
  { instructor: "위그로", platform: "머니업클래스", course: "AI 로켓그로스" },
  { instructor: "페이지부스터", platform: "머니업클래스", course: "AI 상세페이지" },
  { instructor: "박연우", platform: "머니업클래스", course: "공동구매" },
  { instructor: "유메이커", platform: "머니업클래스", course: "AI 뉴스 롱폼" },
  { instructor: "건강셀러", platform: "머니업클래스", course: "건기식" },
  { instructor: "싸다구셀러", platform: "머니업클래스", course: "라이브 커머스" },
  { instructor: "킴브로", platform: "머니업클래스", course: "AI 숏츠" },
  { instructor: "파이호", platform: "머니업클래스", course: "유튜브 브랜딩" },

  // ── 부스트머니랩 ──
  { instructor: "선한부자오가닉", platform: "부스트머니랩", course: "구글 애드센스" },
  // 선한부자오가닉은 DB에 머니업클래스로도 저장됨
  { instructor: "선한부자오가닉", platform: "머니업클래스", course: "구글 애드센스" },
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
