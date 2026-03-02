import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/move-platform
 * 강의(코스)의 플랫폼을 변경 (같은 강사의 같은 강의를 다른 플랫폼으로 이동)
 *
 * Body: { instructor, course, fromPlatform, toPlatform }
 */
export async function POST(req: NextRequest) {
  try {
    const { instructor, course, fromPlatform, toPlatform } = await req.json();

    if (!instructor || !fromPlatform || !toPlatform || course === undefined) {
      return NextResponse.json(
        { error: "instructor, course, fromPlatform, toPlatform 필요" },
        { status: 400 }
      );
    }

    if (fromPlatform === toPlatform) {
      return NextResponse.json({ ok: true, updated: 0, message: "변경 없음" });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("surveys")
      .update({ platform: toPlatform })
      .eq("platform", fromPlatform)
      .eq("instructor", instructor)
      .eq("course", course)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      updated: data?.length || 0,
      message: `'${course}' ${fromPlatform} → ${toPlatform} ${data?.length || 0}건 이동`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "플랫폼 이동 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
