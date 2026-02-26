import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * 스케줄(PM, 시작일, VOD 종료일) 수정 API
 * 해당 platform + instructor + cohort (+ course) 에 매칭되는 surveys 행 전부 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const { platform, instructor, course, cohort, pm, startDate, endDate } = await req.json();

    if (!platform || !instructor || !cohort) {
      return NextResponse.json({ error: "platform, instructor, cohort 필수" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 매칭 조건: platform + instructor + cohort + course(있는 경우)
    let query = supabase
      .from("surveys")
      .update({
        ...(pm !== undefined && { pm }),
        ...(startDate !== undefined && { start_date: startDate }),
        ...(endDate !== undefined && { end_date: endDate }),
      })
      .eq("platform", platform)
      .eq("instructor", instructor)
      .eq("cohort", cohort);

    if (course) {
      query = query.eq("course", course);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("update-schedule error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "업데이트 실패";
    console.error("update-schedule error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
