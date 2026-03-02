import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/delete-course
 * 강의 삭제: 해당 강의의 모든 기수 + 설문 데이터를 DB에서 삭제
 *
 * Body: { platform, instructor, course }
 */
export async function POST(req: NextRequest) {
  try {
    const { platform, instructor, course } = await req.json();

    if (!platform || !instructor || course === undefined) {
      return NextResponse.json(
        { error: "platform, instructor, course 필요" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. 해당 강의의 모든 survey ID 조회
    const { data: surveys, error: findError } = await supabase
      .from("surveys")
      .select("id")
      .eq("platform", platform)
      .eq("instructor", instructor)
      .eq("course", course);

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, message: "삭제할 데이터 없음" });
    }

    const surveyIds = surveys.map((s) => s.id);

    // 2. survey_responses 삭제
    const { error: respError } = await supabase
      .from("survey_responses")
      .delete()
      .in("survey_id", surveyIds);

    if (respError) {
      console.error("survey_responses delete error:", respError);
    }

    // 3. comments 삭제
    const { error: commError } = await supabase
      .from("comments")
      .delete()
      .in("survey_id", surveyIds);

    if (commError) {
      console.error("comments delete error:", commError);
    }

    // 4. surveys 삭제
    const { error: survError } = await supabase
      .from("surveys")
      .delete()
      .in("id", surveyIds);

    if (survError) {
      return NextResponse.json({ error: survError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deleted: surveyIds.length,
      message: `'${course}' 강의 삭제 완료 (설문 ${surveyIds.length}건)`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "강의 삭제 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
