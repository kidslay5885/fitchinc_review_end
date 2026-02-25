import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/rename-course
 * 강의명 변경 (DB의 surveys.course 업데이트)
 * 같은 이름으로 변경하면 자동으로 병합됨
 *
 * Body: { platform, instructor, oldCourse, newCourse }
 * - oldCourse: 현재 강의명 ("" = 기본 과정)
 * - newCourse: 새 강의명
 */
export async function POST(req: NextRequest) {
  try {
    const { platform, instructor, oldCourse, newCourse } = await req.json();

    if (!platform || !instructor || oldCourse === undefined || newCourse === undefined) {
      return NextResponse.json(
        { error: "platform, instructor, oldCourse, newCourse 필요" },
        { status: 400 }
      );
    }

    if (oldCourse === newCourse) {
      return NextResponse.json({ ok: true, updated: 0, message: "변경 없음" });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("surveys")
      .update({ course: newCourse })
      .eq("platform", platform)
      .eq("instructor", instructor)
      .eq("course", oldCourse)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      updated: data?.length || 0,
      message: `'${oldCourse || "(기본 과정)"}' → '${newCourse || "(기본 과정)"}' ${data?.length || 0}건 변경`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "강의명 변경 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
