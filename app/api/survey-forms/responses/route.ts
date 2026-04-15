import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase 1000행 제한을 우회하는 전체 조회 */
async function fetchAllResponses(
  supabase: SupabaseClient,
  surveyIds: string[],
  columns: string,
) {
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("survey_responses")
      .select(columns)
      .in("survey_id", surveyIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return all;
}

/** 특정 설문 폼의 응답 데이터를 조회 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const giftMode = req.nextUrl.searchParams.get("giftMode") === "true";

    // ===== giftMode: 후기 설문 전체의 응답을 한번에 조회 =====
    if (giftMode) {
      // 1. 후기 설문 폼 전체 조회
      const { data: postForms } = await supabase
        .from("survey_forms")
        .select("id, platform, instructor, course, cohort, survey_type")
        .eq("survey_type", "후기");

      if (!postForms || postForms.length === 0) {
        return NextResponse.json({ responses: [], forms: [] });
      }

      // 2. 각 폼에 매칭되는 surveys 조회
      const allSurveyIds: string[] = [];
      const surveyToForm: Record<string, { instructor: string; cohort: string; formId: string }> = {};

      for (const f of postForms) {
        const { data: surveys } = await supabase
          .from("surveys")
          .select("id")
          .match({
            platform: f.platform,
            instructor: f.instructor,
            course: f.course,
            cohort: f.cohort,
            survey_type: f.survey_type,
          });

        if (surveys) {
          for (const s of surveys) {
            allSurveyIds.push(s.id);
            surveyToForm[s.id] = { instructor: f.instructor, cohort: f.cohort || "", formId: f.id };
          }
        }
      }

      if (allSurveyIds.length === 0) {
        return NextResponse.json({ responses: [], forms: postForms });
      }

      // 3. 전체 응답 조회 (phone, gift_sent 포함)
      const giftColumns = "id, survey_id, name, phone, gift_sent, gift_sent_at, gift_amount, created_at";
      const responses = await fetchAllResponses(supabase, allSurveyIds, giftColumns);

      // 4. 응답에 강사/기수 정보 부착
      const enriched = responses.map((r) => {
        const meta = surveyToForm[r.survey_id as string] || {};
        return { ...r, instructor: meta.instructor || "", cohort: meta.cohort || "", formId: meta.formId || "" };
      });

      return NextResponse.json({ responses: enriched, forms: postForms });
    }

    // ===== 기존 모드: formId 기반 조회 =====
    const formId = req.nextUrl.searchParams.get("formId");
    if (!formId) {
      return NextResponse.json({ error: "formId가 필요합니다" }, { status: 400 });
    }

    // mode=list → 목록용 (raw_data 제외, limit/offset 지원)
    // mode=full → 결과 페이지용 (raw_data 포함, 전체 조회)
    const mode = req.nextUrl.searchParams.get("mode") || "full";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "0") || 0;
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0") || 0;

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
    if (mode === "list") {
      // 목록용: raw_data 제외 + limit/offset 지원
      const listColumns = "name, gender, age, job, channel, phone, gift_sent, ps1, ps2, p_rec, created_at";
      let query = supabase
        .from("survey_responses")
        .select(listColumns, { count: "exact" })
        .in("survey_id", surveyIds)
        .order("created_at", { ascending: false });

      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data: responses, error: respError, count } = await query;

      if (respError) {
        return NextResponse.json({ error: respError.message }, { status: 500 });
      }

      return NextResponse.json({
        responses: responses || [],
        count: totalCount,
        total: count ?? (responses?.length || 0),
      });
    }

    // 결과 페이지용: raw_data 포함 + 전체 조회 (1000행 한계 우회)
    const fullColumns = "name, gender, age, job, hours, channel, computer, goal, phone, gift_sent, gift_sent_at, ps1, ps2, p_sat, p_fmt, p_free, p_rec, raw_data, created_at";
    const responses = await fetchAllResponses(supabase, surveyIds, fullColumns);

    return NextResponse.json({ responses, count: totalCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
