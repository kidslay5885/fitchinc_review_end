/**
 * 강의 일정 데이터 — 설문 업로드 시 pm / start_date / end_date 자동 매칭용
 *
 * 매칭 키: platform + instructor + cohort (+ course)
 * startDate = 정규강의 시작, endDate = VOD 종료
 */

interface Schedule {
  platform: string;
  instructor: string;
  cohort: string;
  course: string;
  pm: string;
  startDate: string; // 정규강의 시작
  endDate: string;   // VOD 종료
}

const schedules: Schedule[] = [
  { platform: "핏크닉", instructor: "러셀", cohort: "9기", course: "RDX", pm: "원소영", startDate: "2025-08-23", endDate: "2025-12-27" },
  { platform: "머니업클래스", instructor: "돈버는형님들", cohort: "1기", course: "AI 쇼핑몰 수익화 클래스", pm: "김동휘", startDate: "2025-09-05", endDate: "2025-12-26" },
  { platform: "핏크닉", instructor: "온백", cohort: "1기", course: "AI 브랜드 커넥터 실전클래스", pm: "김동휘", startDate: "2025-09-09", endDate: "2025-12-27" },
  { platform: "핏크닉", instructor: "디선제압", cohort: "4기", course: "월 300 AI 상세페이지 프로젝트", pm: "김상중", startDate: "2025-09-12", endDate: "2026-01-13" },
  { platform: "핏크닉", instructor: "부자꿈틀", cohort: "3기", course: "AI숏폼 월급 3배 수익화 프로젝트", pm: "김상중", startDate: "2025-09-19", endDate: "2026-01-10" },
  { platform: "머니업클래스", instructor: "싸다구셀러", cohort: "1기", course: "쇼핑 라이브 수익화 클래스", pm: "김동휘", startDate: "2025-09-20", endDate: "2026-01-18" },
  { platform: "머니업클래스", instructor: "셀팜", cohort: "2기", course: "AI 숏폼 수익화 프로젝트", pm: "원소영", startDate: "2025-09-25", endDate: "2026-01-16" },
  { platform: "핏크닉", instructor: "온물주", cohort: "7기", course: "1000만원 달성 챌린지 AI 쿠팡 끝판왕 클래스", pm: "김동휘", startDate: "2025-09-27", endDate: "2026-01-18" },
  { platform: "머니업클래스", instructor: "선한부자오가닉", cohort: "1기", course: "AI 애드센스 올인원클래스", pm: "박응석", startDate: "2025-09-27", endDate: "2026-01-25" },
  { platform: "핏크닉", instructor: "부자꿈틀", cohort: "6기", course: "과일위탁 수익 클래스", pm: "원소영", startDate: "2025-09-27", endDate: "2026-01-17" },
  { platform: "핏크닉", instructor: "민대표", cohort: "1기", course: "AI 버티컬 커머스 프로젝트", pm: "김상중", startDate: "2025-10-02", endDate: "2026-01-23" },
  { platform: "머니업클래스", instructor: "페이지부스터", cohort: "1기", course: "AI 상세페이지 마스터 클래스", pm: "원소영", startDate: "2025-10-03", endDate: "2026-01-25" },
  { platform: "핏크닉", instructor: "머니테이커", cohort: "19기", course: "파이널VIP 코스", pm: "김동휘", startDate: "2025-10-04", endDate: "2026-01-25" },
  { platform: "핏크닉", instructor: "제이온리_렛츠윤", cohort: "1기", course: "SNS 수익화 마스터 클래스", pm: "원소영", startDate: "2025-10-16", endDate: "2026-01-12" },
  { platform: "핏크닉", instructor: "윙스", cohort: "1기", course: "AI 유튜브 숏폼,롱폼 올인원 코스", pm: "김상중", startDate: "2025-10-21", endDate: "2026-02-11" },
  { platform: "핏크닉", instructor: "셀링남", cohort: "4기", course: "AI 로켓그로스 올인원 클래스", pm: "원소영", startDate: "2025-10-23", endDate: "2026-02-09" },
  { platform: "핏크닉", instructor: "이디", cohort: "1기", course: "AI 상세페이지 클래스", pm: "김동휘", startDate: "2025-10-29", endDate: "2026-02-19" },
  { platform: "핏크닉", instructor: "정쌤", cohort: "2기", course: "AI 로켓그로스 안전마진 로드맵", pm: "김상중", startDate: "2025-10-29", endDate: "2026-02-15" },
  { platform: "머니업클래스", instructor: "셀팜", cohort: "3기", course: "AI 유튜브 수익화 프로젝트", pm: "원소영", startDate: "2025-10-31", endDate: "2026-02-21" },
  { platform: "핏크닉", instructor: "셀링남", cohort: "1기", course: "AI 브랜드 파이프 시크릿 로드맵", pm: "원소영", startDate: "2025-11-03", endDate: "2026-02-22" },
  { platform: "머니업클래스", instructor: "돈버는형님들", cohort: "2기", course: "AI 쇼핑몰 수익화 클래스", pm: "김동휘", startDate: "2025-11-06", endDate: "2026-02-27" },
  { platform: "핏크닉", instructor: "러셀", cohort: "10기", course: "RDX", pm: "원소영", startDate: "2025-11-08", endDate: "2026-03-18" },
  { platform: "핏크닉", instructor: "셀팜", cohort: "6기", course: "쿠팡 농수산물 시크릿 코스", pm: "김상중", startDate: "2025-11-11", endDate: "2026-03-02" },
  { platform: "핏크닉", instructor: "디선제압", cohort: "5기", course: "월 300 AI 상세페이지 프로젝트", pm: "김상중", startDate: "2025-11-13", endDate: "2026-03-04" },
  { platform: "머니업클래스", instructor: "위그로", cohort: "2기", course: "AI 쿠팡 올인원 패키지", pm: "원소영", startDate: "2025-11-14", endDate: "2026-03-05" },
  { platform: "핏크닉", instructor: "온백", cohort: "2기", course: "AI 브랜드 커넥터 실전클래스", pm: "김동휘", startDate: "2025-11-18", endDate: "2026-03-06" },
  { platform: "머니업클래스", instructor: "윙스", cohort: "1기", course: "AI로 월급버는 상세페이지 프로젝트", pm: "김동휘", startDate: "2025-11-20", endDate: "2026-03-16" },
  { platform: "핏크닉", instructor: "부자꿈틀", cohort: "4기", course: "AI숏폼 월급 3배 수익화 프로젝트", pm: "김상중", startDate: "2025-11-21", endDate: "2026-03-12" },
  { platform: "핏크닉", instructor: "파이스터디", cohort: "3기", course: "월 300 AI 쇼핑몰 대량등록 클래스", pm: "원소영", startDate: "2025-11-21", endDate: "2025-12-21" },
  { platform: "핏크닉", instructor: "민대표", cohort: "2기", course: "AI 버티컬 커머스 프로젝트", pm: "김상중", startDate: "2025-11-27", endDate: "2026-03-18" },
  { platform: "핏크닉", instructor: "머니테이커", cohort: "20기", course: "파이널VIP 코스", pm: "김동휘, 강은비", startDate: "2025-12-02", endDate: "2026-03-23" },
  { platform: "머니업클래스", instructor: "플로이쨈", cohort: "1기", course: "AI 공장으로 월 2천 유튜브 수익 자동화", pm: "원소영", startDate: "2025-12-04", endDate: "2026-03-25" },
  { platform: "핏크닉", instructor: "부자꿈틀", cohort: "7기", course: "과일위탁 수익 클래스", pm: "주수현", startDate: "2025-12-04", endDate: "2026-03-25" },
  { platform: "머니업클래스", instructor: "페이지부스터", cohort: "2기", course: "AI 상세페이지 마스터 클래스", pm: "원소영", startDate: "2025-12-05", endDate: "2026-03-26" },
  { platform: "핏크닉", instructor: "셀링남", cohort: "5기", course: "AI 로켓그로스 올인원 클래스", pm: "강은비", startDate: "2025-12-09", endDate: "2026-03-28" },
  { platform: "핏크닉", instructor: "윙스", cohort: "2기", course: "시니어 타겟 주제로 월 2천 유튜브 수익 자동화", pm: "김동휘", startDate: "2025-12-11", endDate: "2026-03-28" },
  { platform: "머니업클래스", instructor: "셀링남", cohort: "2기", course: "AI 브랜드 파이프 시크릿 로드맵", pm: "주수현", startDate: "2025-12-16", endDate: "2026-04-05" },
  { platform: "핏크닉", instructor: "제이온리_렛츠윤", cohort: "2기", course: "월급 5배 SNS 수익화 마스터", pm: "원소영", startDate: "2025-12-18", endDate: "2026-04-06" },
  { platform: "머니업클래스", instructor: "셀팜", cohort: "4기", course: "AI 유튜브 수익화 프로젝트", pm: "박응석, 강은비", startDate: "2025-12-19", endDate: "2026-04-05" },
  { platform: "머니업클래스", instructor: "돈버는형님들", cohort: "3기", course: "AI 쇼핑몰 수익화 클래스", pm: "김동휘", startDate: "2025-12-23", endDate: "2026-04-13" },
  { platform: "머니업클래스", instructor: "유메이커", cohort: "1기", course: "AI 유튜브 비밀공식", pm: "박응석", startDate: "2025-12-25", endDate: "2026-04-12" },
  { platform: "핏크닉", instructor: "머니테이커", cohort: "21기", course: "파이널VIP 코스", pm: "강은비", startDate: "2026-01-02", endDate: "2026-04-20" },
  { platform: "핏크닉", instructor: "온백", cohort: "3기", course: "AI 브랜드 커넥터 실전클래스", pm: "김동휘", startDate: "2026-01-08", endDate: "2026-04-26" },
  { platform: "핏크닉", instructor: "디선제압", cohort: "6기", course: "월 300 AI 상세페이지 프로젝트", pm: "강은비", startDate: "2026-01-09", endDate: "2026-05-04" },
  { platform: "핏크닉", instructor: "민대표", cohort: "3기", course: "AI 버티컬 커머스 프로젝트", pm: "김상중", startDate: "2026-01-15", endDate: "2026-05-05" },
  { platform: "머니업클래스", instructor: "셀링남", cohort: "3기", course: "AI 브랜드 파이프 시크릿 로드맵", pm: "주수현", startDate: "2026-01-18", endDate: "2026-05-09" },
  { platform: "머니업클래스", instructor: "윙스", cohort: "1기", course: "AI 딸깍 쇼핑 숏폼", pm: "원소영", startDate: "2026-01-22", endDate: "2026-05-05" },
  { platform: "핏크닉", instructor: "정쌤", cohort: "3기", course: "AI 로켓그로스 안전마진 로드맵", pm: "김상중", startDate: "2026-01-24", endDate: "2026-05-14" },
  { platform: "핏크닉", instructor: "부자꿈틀", cohort: "5기", course: "AI숏폼 월급 3배 수익화 프로젝트", pm: "김동휘", startDate: "2026-01-29", endDate: "2026-05-19" },
  { platform: "머니업클래스", instructor: "셀팜", cohort: "5기", course: "AI 롱폼 애니메이션 월 300", pm: "강은비", startDate: "2026-01-30", endDate: "2026-05-13" },
  { platform: "핏크닉", instructor: "김놀부", cohort: "4기", course: "푸드릴스 수익화 프로젝트", pm: "주수현", startDate: "2026-02-03", endDate: "2026-05-17" },
  { platform: "핏크닉", instructor: "지인옥", cohort: "1기", course: "AI 롱폼 유튜브 수익화", pm: "김상중", startDate: "2026-02-05", endDate: "2026-06-02" },
  { platform: "핏크닉", instructor: "셀링남", cohort: "1기", course: "쿠팡 무경쟁 소싱법 클래스", pm: "주수현", startDate: "2026-02-08", endDate: "2026-06-01" },
  { platform: "머니업클래스", instructor: "유메이커", cohort: "2기", course: "AI유튜브 비밀 수익화 공식", pm: "원소영", startDate: "2026-02-10", endDate: "2026-05-21" },
  { platform: "핏크닉", instructor: "윙스", cohort: "3기", course: "월 1000 버는 AI 유튜브 수익화", pm: "김동휘", startDate: "2026-02-12", endDate: "2026-06-01" },
  { platform: "머니업클래스", instructor: "페이지부스터", cohort: "3기", course: "AI 상세페이지 마스터 클래스", pm: "강은비", startDate: "2026-02-13", endDate: "2026-06-06" },
  { platform: "핏크닉", instructor: "부자꿈틀", cohort: "8기", course: "과일위탁 수익 클래스", pm: "김동휘", startDate: "2026-02-13", endDate: "2026-06-06" },
  { platform: "머니업클래스", instructor: "셀링남", cohort: "4기", course: "AI 브랜드 파이프 시크릿 로드맵", pm: "주수현", startDate: "2026-02-23", endDate: "2026-06-18" },
  { platform: "핏크닉", instructor: "셀팜", cohort: "1기", course: "월 300 AI 유튜브 연금", pm: "원소영", startDate: "2026-02-25", endDate: "2026-06-18" },
  { platform: "핏크닉", instructor: "민대표", cohort: "4기", course: "AI 버티컬 커머스 프로젝트", pm: "강은비", startDate: "2026-02-27", endDate: "2026-06-19" },
];

// 4-key 맵 (platform||instructor||cohort||course) — 정확 매칭용
const scheduleMap4 = new Map<string, Schedule>();
// 3-key 맵 (platform||instructor||cohort) — 폴백용 (같은 키가 여러 개면 마지막 것)
const scheduleMap3 = new Map<string, Schedule>();

for (const s of schedules) {
  scheduleMap4.set(`${s.platform}||${s.instructor}||${s.cohort}||${s.course}`, s);
  scheduleMap3.set(`${s.platform}||${s.instructor}||${s.cohort}`, s);
}

/**
 * platform + instructor + cohort (+ course) 로 일정 조회
 * course 전달 시 정확 매칭, 없으면 기존 3-key 방식 폴백
 * @returns { pm, startDate, endDate, course } 또는 null
 */
export function findSchedule(
  platform: string | null,
  instructor: string | null,
  cohort: string | null,
  course?: string | null
): { pm: string; startDate: string; endDate: string; course: string } | null {
  if (!platform || !instructor || !cohort) return null;

  // course가 있으면 4-key 정확 매칭 시도
  if (course) {
    const hit4 = scheduleMap4.get(`${platform}||${instructor}||${cohort}||${course}`);
    if (hit4) return { pm: hit4.pm, startDate: hit4.startDate, endDate: hit4.endDate, course: hit4.course };
  }

  // 3-key 폴백
  const hit3 = scheduleMap3.get(`${platform}||${instructor}||${cohort}`);
  return hit3 ? { pm: hit3.pm, startDate: hit3.startDate, endDate: hit3.endDate, course: hit3.course } : null;
}
