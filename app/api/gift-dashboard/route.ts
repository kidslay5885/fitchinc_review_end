import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase 1000행 제한 우회 페이지네이션 */
async function fetchAll(
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

/** 기프티쇼 관리 전용 대시보드 API */
export async function GET() {
  try {
    const supabase = getSupabase();

    // 1. 후기 설문 폼 전체 조회
    const { data: postForms, error: formErr } = await supabase
      .from("survey_forms")
      .select("id, platform, instructor, course, cohort, survey_type")
      .eq("survey_type", "후기");

    if (formErr) throw formErr;
    if (!postForms || postForms.length === 0) {
      return NextResponse.json({
        responses: [],
        stats: { total: 0, sent: 0, pending: 0 },
      });
    }

    // 2. 모든 후기 폼의 매칭 surveys를 한번에 조회 (OR 조건)
    const surveyToMeta: Record<string, {
      instructor: string; cohort: string; course: string; platform: string;
    }> = {};
    const allSurveyIds: string[] = [];

    // 폼별 개별 쿼리 (match 조건이 복합키이므로 OR로 합칠 수 없음)
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
          surveyToMeta[s.id] = {
            instructor: f.instructor,
            cohort: f.cohort || "",
            course: f.course || "",
            platform: f.platform || "",
          };
        }
      }
    }

    if (allSurveyIds.length === 0) {
      return NextResponse.json({
        responses: [],
        stats: { total: 0, sent: 0, pending: 0 },
      });
    }

    // 3. 응답 전체 조회
    const columns = "id, survey_id, name, phone, gift_sent, gift_sent_at, created_at";
    const raw = await fetchAll(supabase, allSurveyIds, columns);

    // 4. 메타데이터 enrichment
    let sent = 0;
    const responses = raw.map((r) => {
      const meta = surveyToMeta[r.survey_id as string] || {};
      if (r.gift_sent) sent++;
      return {
        id: r.id as string,
        name: r.name as string,
        phone: (r.phone || "") as string,
        gift_sent: !!r.gift_sent,
        gift_sent_at: (r.gift_sent_at || null) as string | null,
        created_at: r.created_at as string,
        instructor: meta.instructor || "",
        cohort: meta.cohort || "",
        course: meta.course || "",
        platform: meta.platform || "",
      };
    });

    return NextResponse.json({
      responses,
      stats: {
        total: responses.length,
        sent,
        pending: responses.length - sent,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
