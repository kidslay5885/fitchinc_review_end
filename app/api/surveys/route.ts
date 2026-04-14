import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";

export async function GET() {
  try {
    const supabase = getSupabase();

    const data = await fetchAllRanges<Record<string, unknown>>((from, to, withCount) =>
      supabase
        .from("surveys")
        .select("*", withCount ? { count: "exact" } : undefined)
        .order("created_at", { ascending: false })
        .range(from, to),
    );

    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const supabase = getSupabase();

    // 연관 데이터 먼저 삭제 (고아 레코드 방지)
    await supabase.from("comments").delete().eq("survey_id", id);
    await supabase.from("survey_responses").delete().eq("survey_id", id);

    const { error } = await supabase.from("surveys").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "삭제 실패";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
