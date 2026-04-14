import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";

// rawData(JSONB) 값을 모두 문자열로 정규화
function normalizeRawData(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null || typeof v === "object") continue;
    result[k] = String(v);
  }
  return result;
}

// survey_responses 조회 후 정규화 — Supabase 1000행 제한 우회 위해 병렬 페이지네이션
async function fetchResponses(supabase: ReturnType<typeof getSupabase>, ids: string[]) {
  if (ids.length === 0) return [];

  const PAGE = 1000;

  // 1) 첫 페이지 + 총 행수
  const first = await supabase
    .from("survey_responses")
    .select("*", { count: "exact" })
    .in("survey_id", ids)
    .order("created_at")
    .range(0, PAGE - 1);
  if (first.error) throw first.error;

  const firstRows = (first.data as Record<string, unknown>[]) || [];
  const total = typeof first.count === "number" ? first.count : firstRows.length;

  let allRaw: Record<string, unknown>[] = firstRows;

  // 2) 남은 페이지 병렬 요청
  if (total > PAGE) {
    const pageCount = Math.ceil(total / PAGE);
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) =>
        supabase
          .from("survey_responses")
          .select("*")
          .in("survey_id", ids)
          .order("created_at")
          .range((i + 1) * PAGE, (i + 2) * PAGE - 1)
      )
    );
    for (const r of rest) {
      if (r.error) throw r.error;
      allRaw = allRaw.concat((r.data as Record<string, unknown>[]) || []);
    }
  }

  return allRaw.map((r) => ({
    id: r.id,
    survey_id: r.survey_id as string,
    name: String(r.name ?? ""),
    gender: String(r.gender ?? ""),
    age: String(r.age ?? ""),
    job: String(r.job ?? ""),
    hours: String(r.hours ?? ""),
    channel: String(r.channel ?? ""),
    computer: Number(r.computer) || 0,
    goal: String(r.goal ?? ""),
    hopePlatform: String(r.hope_platform ?? ""),
    hopeInstructor: String(r.hope_instructor ?? ""),
    ps1: Number(r.ps1) || 0,
    ps2: Number(r.ps2) || 0,
    pSat: String(r.p_sat ?? ""),
    pFmt: String(r.p_fmt ?? ""),
    pFree: String(r.p_free ?? ""),
    pRec: String(r.p_rec ?? ""),
    rawData: normalizeRawData(r.raw_data),
  }));
}

// POST: 응답 데이터 일괄 조회
// 지원 형식:
//  - { platform, instructor, cohorts } → 단일 강사 (기존 호환)
//  - { platform, instructors: [{ name, cohorts }] } → 여러 강사 한 번에 (플랫폼 진입 시 사용)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      platform: string;
      instructor?: string;
      cohorts?: { course: string; cohort: string }[];
      instructors?: { name: string; cohorts: { course: string; cohort: string }[] }[];
    };
    const { platform } = body;

    // 단일/다중 강사 입력을 다중 형태로 정규화
    const items = body.instructors
      ? body.instructors
      : body.instructor && body.cohorts
        ? [{ name: body.instructor, cohorts: body.cohorts }]
        : [];

    if (!platform || items.length === 0) {
      return NextResponse.json({ error: "platform + (instructor,cohorts) 또는 instructors 필수" }, { status: 400 });
    }

    const supabase = getSupabase();

    const instructorNames = items.map((it) => it.name);
    // 요청된 (강사, 코스, 기수) 조합 집합
    const wantedKeys = new Set<string>();
    for (const it of items) {
      for (const c of it.cohorts) wantedKeys.add(`${it.name}||${c.course}||${c.cohort}`);
    }

    // 해당 플랫폼의 요청 강사들 survey를 한 번에 조회 (1000행 제한 우회)
    const surveys = await fetchAllRanges<{
      id: string;
      survey_type: string | null;
      instructor: string | null;
      course: string | null;
      cohort: string | null;
    }>((from, to, withCount) =>
      supabase
        .from("surveys")
        .select("id, survey_type, instructor, course, cohort", withCount ? { count: "exact" } : undefined)
        .eq("platform", platform)
        .in("instructor", instructorNames)
        .range(from, to),
    );

    // 결과 맵 초기화 (요청된 (강사, 코스, 기수)마다 빈 슬롯)
    const resultMap = new Map<
      string,
      { instructor: string; course: string; cohort: string; preResponses: unknown[]; postResponses: unknown[] }
    >();
    for (const it of items) {
      for (const c of it.cohorts) {
        resultMap.set(`${it.name}||${c.course}||${c.cohort}`, {
          instructor: it.name,
          course: c.course,
          cohort: c.cohort,
          preResponses: [],
          postResponses: [],
        });
      }
    }

    if (surveys.length === 0) {
      return NextResponse.json({ results: Array.from(resultMap.values()) });
    }

    // surveyId → (강사, 코스, 기수) 매핑
    const preSurveyIds: string[] = [];
    const postSurveyIds: string[] = [];
    const surveyToKey = new Map<string, string>();

    for (const s of surveys) {
      const key = `${s.instructor || ""}||${s.course || ""}||${s.cohort || ""}`;
      if (!wantedKeys.has(key)) continue;
      surveyToKey.set(s.id, key);
      if (s.survey_type === "사전") preSurveyIds.push(s.id);
      else postSurveyIds.push(s.id);
    }

    // pre / post 응답을 병렬 2쿼리로 한 번에
    const [allPre, allPost] = await Promise.all([
      fetchResponses(supabase, preSurveyIds),
      fetchResponses(supabase, postSurveyIds),
    ]);

    for (const r of allPre) {
      const k = surveyToKey.get(r.survey_id);
      if (k && resultMap.has(k)) resultMap.get(k)!.preResponses.push(r);
    }
    for (const r of allPost) {
      const k = surveyToKey.get(r.survey_id);
      if (k && resultMap.has(k)) resultMap.get(k)!.postResponses.push(r);
    }

    return NextResponse.json({ results: Array.from(resultMap.values()) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "일괄 조회 실패";
    console.warn("responses batch API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: 기수별 응답 데이터 조회 (단건 - 하위 호환)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const platform = searchParams.get("platform");
    const instructor = searchParams.get("instructor");
    const course = searchParams.get("course");
    const cohort = searchParams.get("cohort");

    if (!platform || !instructor) {
      return NextResponse.json({ error: "platform, instructor 필수" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 해당 조건의 survey 조회 (1000행 제한 우회)
    let surveys: { id: string; survey_type: string | null }[];
    try {
      surveys = await fetchAllRanges<{ id: string; survey_type: string | null }>((from, to, withCount) => {
        let q = supabase
          .from("surveys")
          .select("id, survey_type", withCount ? { count: "exact" } : undefined)
          .eq("platform", platform)
          .eq("instructor", instructor);
        if (course != null) q = q.eq("course", course);
        if (cohort) q = q.eq("cohort", cohort);
        return q.range(from, to);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "surveys query error";
      console.warn("surveys query error:", msg);
      return NextResponse.json({ preResponses: [], postResponses: [], _error: msg });
    }

    if (surveys.length === 0) {
      return NextResponse.json({ preResponses: [], postResponses: [] });
    }

    const preSurveyIds = surveys.filter((s) => s.survey_type === "사전").map((s) => s.id);
    const postSurveyIds = surveys.filter((s) => s.survey_type === "후기").map((s) => s.id);

    const [preResponses, postResponses] = await Promise.all([
      fetchResponses(supabase, preSurveyIds),
      fetchResponses(supabase, postSurveyIds),
    ]);

    return NextResponse.json({ preResponses, postResponses });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "응답 조회 실패";
    console.warn("responses API error:", msg);
    // Supabase 연결 실패 등 → 빈 데이터로 fallback (클라이언트 throw 방지)
    return NextResponse.json({ preResponses: [], postResponses: [], _error: msg });
  }
}
