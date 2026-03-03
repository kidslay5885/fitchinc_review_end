import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET: 기수별 응답 데이터 조회
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
      // rawData(JSONB) 값을 모두 문자열로 정규화 (객체/숫자/불린 → String)
      const normalizeRawData = (raw: unknown): Record<string, string> => {
        if (!raw || typeof raw !== "object") return {};
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (v == null) continue;
          if (typeof v === "object") {
            // 중첩 객체/배열 → JSON 문자열로 변환하지 않고 스킵
            continue;
          }
          result[k] = String(v);
        }
        return result;
      };

      return (data || []).map((r) => ({
        id: r.id,
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
    };

    const [preResponses, postResponses] = await Promise.all([
      fetchResponses(preSurveyIds),
      fetchResponses(postSurveyIds),
    ]);

    return NextResponse.json({ preResponses, postResponses });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "응답 조회 실패";
    console.warn("responses API error:", msg);
    // Supabase 연결 실패 등 → 빈 데이터로 fallback (클라이언트 throw 방지)
    return NextResponse.json({ preResponses: [], postResponses: [], _error: msg });
  }
}
