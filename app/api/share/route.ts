import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import crypto from "crypto";

// GET: 특정 설문의 공유 링크 목록
export async function GET(req: NextRequest) {
  try {
    const surveyId = req.nextUrl.searchParams.get("surveyId");
    const supabase = getSupabase();

    let query = supabase
      .from("share_links")
      .select("*")
      .order("created_at", { ascending: false });

    if (surveyId) {
      // survey 정보로 필터링
      const { data: survey } = await supabase
        .from("surveys")
        .select("platform, instructor, cohort")
        .eq("id", surveyId)
        .single();

      if (survey) {
        if (survey.platform) query = query.eq("filter_platform", survey.platform);
        if (survey.instructor) query = query.eq("filter_instructor", survey.instructor);
        if (survey.cohort) query = query.eq("filter_cohort", survey.cohort);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "조회 실패" },
      { status: 500 }
    );
  }
}

// POST: 공유 링크 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = crypto.randomBytes(16).toString("hex");

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("share_links")
      .insert({
        token,
        title: body.title,
        filter_platform: body.filter_platform || null,
        filter_instructor: body.filter_instructor || null,
        filter_cohort: body.filter_cohort || null,
        filter_sentiment: body.filter_sentiment || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "생성 실패" },
      { status: 500 }
    );
  }
}

// DELETE: 공유 링크 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const supabase = getSupabase();

    const { error } = await supabase.from("share_links").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "삭제 실패" },
      { status: 500 }
    );
  }
}
