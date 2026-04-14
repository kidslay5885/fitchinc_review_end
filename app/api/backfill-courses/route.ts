import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";
import { resolveCourse } from "@/lib/course-registry";

/**
 * POST /api/backfill-courses
 * 모든 surveys의 course를 레지스트리 기반으로 재설정.
 * (instructor, platform, filename) → resolveCourse() 로 정확한 강의명 매칭.
 */
export async function POST() {
  try {
    const supabase = getSupabase();

    // 모든 surveys 조회 (1000행 제한 우회)
    const surveys = await fetchAllRanges<{
      id: string;
      filename: string | null;
      platform: string | null;
      instructor: string | null;
      course: string | null;
    }>((from, to, withCount) =>
      supabase
        .from("surveys")
        .select("id, filename, platform, instructor, course", withCount ? { count: "exact" } : undefined)
        .range(from, to),
    );

    if (surveys.length === 0) {
      return NextResponse.json({ message: "설문 데이터 없음", updated: 0 });
    }

    // 업데이트 대상 필터링 (DB 호출 없이 메모리에서)
    const pending: { id: string; filename: string; oldCourse: string; newCourse: string }[] = [];

    for (const s of surveys) {
      const instructor = s.instructor || "";
      const platform = s.platform || "";
      const filename = s.filename || "";
      const oldCourse = s.course || "";
      const newCourse = resolveCourse(instructor, platform, filename);

      if (newCourse && newCourse !== oldCourse) {
        pending.push({ id: s.id, filename, oldCourse, newCourse });
      }
    }

    // 배치 병렬 업데이트 (50개씩)
    let updated = 0;
    const results: typeof pending = [];
    const BATCH = 50;
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const dbResults = await Promise.all(
        batch.map((u) => supabase.from("surveys").update({ course: u.newCourse }).eq("id", u.id))
      );
      dbResults.forEach((r, idx) => {
        if (!r.error) {
          updated++;
          results.push(batch[idx]);
        }
      });
    }

    const skipped = surveys.length - pending.length;

    return NextResponse.json({
      message: `백필 완료: ${updated}건 업데이트, ${skipped}건 스킵`,
      updated,
      skipped,
      total: surveys.length,
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "백필 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
