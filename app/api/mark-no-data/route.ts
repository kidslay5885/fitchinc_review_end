import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * 설문 "없음" 수동 표시 API
 * POST: 플레이스홀더 설문 생성 (response_count=0, status="classified")
 * DELETE: 플레이스홀더 설문 삭제 (response_count=0인 경우만)
 */

export async function POST(req: NextRequest) {
  try {
    const { platform, instructor, course, cohort, surveyType } = await req.json();

    if (!platform || !instructor || !cohort || !surveyType) {
      return NextResponse.json(
        { error: "platform, instructor, cohort, surveyType 필수" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 이미 해당 설문이 존재하는지 확인
    const { data: existing } = await supabase
      .from("surveys")
      .select("id, response_count")
      .eq("platform", platform)
      .eq("instructor", instructor)
      .eq("course", course || "")
      .eq("cohort", cohort)
      .eq("survey_type", surveyType)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, action: "already_exists", id: existing[0].id });
    }

    // 플레이스홀더 설문 생성
    const { data, error } = await supabase
      .from("surveys")
      .insert({
        filename: `(없음) ${platform}_${instructor}_${course || ""}_${cohort}_${surveyType}`,
        platform,
        instructor,
        course: course || "",
        cohort,
        survey_type: surveyType,
        status: "classified",
        response_count: 0,
        pm: "",
        total_students: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("mark-no-data POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "created", id: data.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "생성 실패";
    console.error("mark-no-data POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { platform, instructor, course, cohort, surveyType } = await req.json();

    if (!platform || !instructor || !cohort || !surveyType) {
      return NextResponse.json(
        { error: "platform, instructor, cohort, surveyType 필수" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // response_count=0인 플레이스홀더만 삭제 (실제 응답이 있는 설문은 보호)
    const { data, error } = await supabase
      .from("surveys")
      .delete()
      .eq("platform", platform)
      .eq("instructor", instructor)
      .eq("course", course || "")
      .eq("cohort", cohort)
      .eq("survey_type", surveyType)
      .eq("response_count", 0)
      .select("id");

    if (error) {
      console.error("mark-no-data DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { ok: false, error: "삭제 대상 없음 (실제 응답이 있는 설문은 삭제할 수 없습니다)" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, action: "deleted", count: data.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "삭제 실패";
    console.error("mark-no-data DELETE error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
