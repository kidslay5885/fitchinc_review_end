import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";

// 업로드된 설문 목록(파일명 + 업로드 시각)을 최신순으로 반환 — 업로드 모달 표시용
export async function GET() {
  try {
    const supabase = getSupabase();

    const surveys = await fetchAllRanges<Record<string, unknown>>((from, to, withCount) =>
      supabase
        .from("surveys")
        .select(
          "id, filename, platform, instructor, course, cohort, survey_type, response_count, created_at",
          withCount ? { count: "exact" } : undefined,
        )
        .order("created_at", { ascending: false })
        .range(from, to),
    );

    return NextResponse.json(surveys, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "업로드 목록 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
