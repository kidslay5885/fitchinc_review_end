import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** 특정 설문 폼의 응답 데이터를 조회 */
export async function GET(req: NextRequest) {
  try {
    const formId = req.nextUrl.searchParams.get("formId");
    if (!formId) {
      return NextResponse.json({ error: "formId가 필요합니다" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. 폼 조회
    const { data: form, error: formError } = await supabase
      .from("survey_forms")
      .select("platform, instructor, course, cohort, survey_type")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: "폼을 찾을 수 없습니다" }, { status: 404 });
    }

    // 2. 매칭되는 surveys 행 조회
    const { data: surveys } = await supabase
      .from("surveys")
      .select("id, response_count")
      .match({
        platform: form.platform,
        instructor: form.instructor,
        course: form.course,
        cohort: form.cohort,
        survey_type: form.survey_type,
      });

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ responses: [], count: 0 });
    }

    const surveyIds = surveys.map((s) => s.id);
    const totalCount = surveys.reduce((sum, s) => sum + (s.response_count || 0), 0);

    // 3. survey_responses 조회
    const { data: responses, error: respError } = await supabase
      .from("survey_responses")
      .select("name, gender, age, job, hours, channel, computer, goal, ps1, ps2, p_sat, p_fmt, p_free, p_rec, raw_data, created_at")
      .in("survey_id", surveyIds)
      .order("created_at", { ascending: false });

    if (respError) {
      return NextResponse.json({ error: respError.message }, { status: 500 });
    }

    return NextResponse.json({ responses: responses || [], count: totalCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
