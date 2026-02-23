import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET: 기수별 응답 데이터 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const platform = searchParams.get("platform");
    const instructor = searchParams.get("instructor");
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

    if (cohort) {
      surveyQuery = surveyQuery.eq("cohort", cohort);
    }

    const { data: surveys, error: surveyError } = await surveyQuery;
    if (surveyError) {
      return NextResponse.json({ error: surveyError.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ preResponses: [], postResponses: [] });
    }

    const surveyIds = surveys.map((s) => s.id);
    const preSurveyIds = surveys.filter((s) => s.survey_type === "사전").map((s) => s.id);
    const postSurveyIds = surveys.filter((s) => s.survey_type === "후기").map((s) => s.id);

    // survey_responses 테이블에서 조회
    const fetchResponses = async (ids: string[]) => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .in("survey_id", ids)
        .order("created_at");
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        name: r.name || "",
        gender: r.gender || "",
        age: r.age || "",
        job: r.job || "",
        hours: r.hours || "",
        channel: r.channel || "",
        computer: r.computer || 0,
        goal: r.goal || "",
        hopePlatform: r.hope_platform || "",
        hopeInstructor: r.hope_instructor || "",
        ps1: r.ps1 || 0,
        ps2: r.ps2 || 0,
        pSat: r.p_sat || "",
        pFmt: r.p_fmt || "",
        pFree: r.p_free || "",
        pRec: r.p_rec || "",
        rawData: r.raw_data || {},
      }));
    };

    const [preResponses, postResponses] = await Promise.all([
      fetchResponses(preSurveyIds),
      fetchResponses(postSurveyIds),
    ]);

    return NextResponse.json({ preResponses, postResponses });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "응답 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
