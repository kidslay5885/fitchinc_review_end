import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const token = req.nextUrl.searchParams.get("token");

    if (token) {
      // 공개 폼 조회 (토큰 기반)
      const { data, error } = await supabase
        .from("survey_forms")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "설문 폼을 찾을 수 없습니다" }, { status: 404 });
      }

      return NextResponse.json({ form: data });
    }

    // 관리자: 전체 목록
    const { data, error } = await supabase
      .from("survey_forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ forms: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, instructor, course, cohort, survey_type, title, description, fields, starts_at, expires_at } = body;

    if (!platform || !instructor || !survey_type) {
      return NextResponse.json({ error: "플랫폼, 강사, 설문 유형은 필수입니다" }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("survey_forms")
      .insert({
        platform,
        instructor,
        course: course || "",
        cohort: cohort || "",
        survey_type,
        title: title || `${instructor} ${cohort || ""} ${survey_type} 설문`,
        description: description || "",
        fields: fields || [],
        is_active: true,
        token,
        starts_at: starts_at || null,
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "폼 생성 실패: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ form: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "생성 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "폼 ID가 필요합니다" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("survey_forms")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "수정 실패: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ form: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "수정 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "폼 ID가 필요합니다" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from("survey_forms")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "삭제 실패: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "삭제 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
