import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/check-classified
 * 재업로드 전 기존 분류 데이터 존재 여부 확인
 * - exists: 해당 조건의 설문이 존재하는지
 * - totalComments: 기존 댓글 총 수
 * - classifiedComments: sentiment가 설정된 (수동/AI 분류된) 댓글 수
 */
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform");
  const instructor = req.nextUrl.searchParams.get("instructor");
  const course = req.nextUrl.searchParams.get("course");
  const cohort = req.nextUrl.searchParams.get("cohort");
  const surveyType = req.nextUrl.searchParams.get("survey_type");

  if (!platform || !instructor || !cohort) {
    return NextResponse.json({ exists: false, totalComments: 0, classifiedComments: 0 });
  }

  try {
    const supabase = getSupabase();

    const match: Record<string, string> = {
      platform,
      instructor,
      cohort,
      survey_type: surveyType || "사전",
    };
    if (course) match.course = course;

    const { data: surveys } = await supabase
      .from("surveys")
      .select("id")
      .match(match);

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ exists: false, totalComments: 0, classifiedComments: 0 });
    }

    const surveyIds = surveys.map((s) => s.id);

    const { count: totalComments } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .in("survey_id", surveyIds);

    // sentiment가 설정된 댓글 = 수동 분류 또는 AI 분류가 완료된 댓글
    const { count: classifiedComments } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .in("survey_id", surveyIds)
      .not("sentiment", "is", null);

    return NextResponse.json({
      exists: true,
      totalComments: totalComments || 0,
      classifiedComments: classifiedComments || 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "확인 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
