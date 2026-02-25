import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET: 댓글 목록 조회 (surveyId 또는 platform+instructor로 조회)
export async function GET(req: NextRequest) {
  try {
    const surveyId = req.nextUrl.searchParams.get("surveyId");
    const platform = req.nextUrl.searchParams.get("platform");
    const instructor = req.nextUrl.searchParams.get("instructor");
    const course = req.nextUrl.searchParams.get("course");
    const cohort = req.nextUrl.searchParams.get("cohort");

    const supabase = getSupabase();

    // 기존 방식: surveyId로 직접 조회
    if (surveyId) {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("survey_id", surveyId)
        .order("created_at");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // 새 방식: platform + instructor로 조회 (course, cohort 선택)
    if (platform && instructor) {
      let surveyQuery = supabase
        .from("surveys")
        .select("id")
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
        return NextResponse.json({ error: surveyError.message }, { status: 500 });
      }

      if (!surveys || surveys.length === 0) {
        return NextResponse.json([]);
      }

      const surveyIds = surveys.map((s) => s.id);
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .in("survey_id", surveyIds)
        .order("created_at");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "surveyId 또는 platform+instructor 필요" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "조회 실패" },
      { status: 500 }
    );
  }
}

// POST: 설문 메타데이터(플랫폼/강사/기수) 저장
export async function POST(req: NextRequest) {
  try {
    const { surveyId, platform, instructor, cohort } = await req.json();

    const supabase = getSupabase();
    const { error } = await supabase
      .from("surveys")
      .update({
        platform,
        instructor,
        cohort,
        status: "classified",
      })
      .eq("id", surveyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "저장 실패" },
      { status: 500 }
    );
  }
}

// PATCH: 개별 댓글의 sentiment 또는 tag 수동 변경
export async function PATCH(req: NextRequest) {
  try {
    const { commentId, sentiment, tag } = await req.json();

    const updates: Record<string, string> = {};
    if (sentiment !== undefined) updates.sentiment = sentiment;
    if (tag !== undefined) updates.tag = tag;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("comments")
      .update(updates)
      .eq("id", commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "수정 실패" },
      { status: 500 }
    );
  }
}
