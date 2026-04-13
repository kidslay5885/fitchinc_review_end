import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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

// survey_responses 조회 후 정규화
async function fetchResponses(supabase: ReturnType<typeof getSupabase>, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("survey_responses")
    .select("*")
    .in("survey_id", ids)
    .order("created_at");
  if (error) throw error;
  return (data || []).map((r) => ({
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

// POST: 여러 기수 응답 데이터 일괄 조회
export async function POST(req: NextRequest) {
  try {
    const { platform, instructor, cohorts } = (await req.json()) as {
      platform: string;
      instructor: string;
      cohorts: { course: string; cohort: string }[];
    };

    if (!platform || !instructor || !cohorts?.length) {
      return NextResponse.json({ error: "platform, instructor, cohorts 필수" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 해당 강사의 모든 survey를 한 번에 조회
    const { data: surveys, error: surveyError } = await supabase
      .from("surveys")
      .select("id, survey_type, course, cohort")
      .eq("platform", platform)
      .eq("instructor", instructor);

    if (surveyError) {
      return NextResponse.json({ error: surveyError.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ results: cohorts.map((c) => ({ course: c.course, cohort: c.cohort, preResponses: [], postResponses: [] })) });
    }

    // 요청된 기수별로 survey ID 분류
    const cohortKeys = new Set(cohorts.map((c) => `${c.course}||${c.cohort}`));
    const preSurveyIds: string[] = [];
    const postSurveyIds: string[] = [];
    // surveyId → cohort 매핑 (응답 분배용)
    const surveyToCohort = new Map<string, string>();

    for (const s of surveys) {
      const key = `${s.course || ""}||${s.cohort || ""}`;
      if (!cohortKeys.has(key)) continue;
      surveyToCohort.set(s.id, key);
      if (s.survey_type === "사전") preSurveyIds.push(s.id);
      else postSurveyIds.push(s.id);
    }

    // 전체 응답을 2번의 쿼리로 한번에 조회
    const [allPre, allPost] = await Promise.all([
      fetchResponses(supabase, preSurveyIds),
      fetchResponses(supabase, postSurveyIds),
    ]);

    // survey_id → cohort key 매핑으로 기수별 분배 (추가 쿼리 없이)
    const resultMap = new Map<string, { course: string; cohort: string; preResponses: typeof allPre; postResponses: typeof allPost }>();
    for (const c of cohorts) {
      resultMap.set(`${c.course}||${c.cohort}`, { course: c.course, cohort: c.cohort, preResponses: [], postResponses: [] });
    }

    for (const r of allPre) {
      const key = surveyToCohort.get(r.survey_id);
      if (key && resultMap.has(key)) resultMap.get(key)!.preResponses.push(r);
    }
    for (const r of allPost) {
      const key = surveyToCohort.get(r.survey_id);
      if (key && resultMap.has(key)) resultMap.get(key)!.postResponses.push(r);
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

    // 해당 조건의 survey 조회
    let surveyQuery = supabase
      .from("surveys")
      .select("id, survey_type")
      .eq("platform", platform)
      .eq("instructor", instructor);

    if (course != null) {
      surveyQuery = surveyQuery.eq("course", course);
    }

    if (cohort) {
      surveyQuery = surveyQuery.eq("cohort", cohort);
    }

    const { data: surveys, error: surveyError } = await surveyQuery;
    if (surveyError) {
      console.warn("surveys query error:", surveyError.message);
      return NextResponse.json({ preResponses: [], postResponses: [], _error: surveyError.message });
    }

    if (!surveys || surveys.length === 0) {
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
