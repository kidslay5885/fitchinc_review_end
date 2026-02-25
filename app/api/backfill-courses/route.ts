import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { resolveCourse } from "@/lib/course-registry";

/**
 * POST /api/backfill-courses
 * 모든 surveys의 course를 레지스트리 기반으로 재설정.
 * (instructor, platform, filename) → resolveCourse() 로 정확한 강의명 매칭.
 */
export async function POST() {
  try {
    const supabase = getSupabase();

    // 모든 surveys 조회
    const { data: surveys, error } = await supabase
      .from("surveys")
      .select("id, filename, platform, instructor, course");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ message: "설문 데이터 없음", updated: 0 });
    }

    let updated = 0;
    let skipped = 0;
    const results: { id: string; filename: string; oldCourse: string; newCourse: string }[] = [];

    for (const s of surveys) {
      const instructor = s.instructor || "";
      const platform = s.platform || "";
      const filename = s.filename || "";
      const oldCourse = s.course || "";

      // 레지스트리에서 올바른 강의명 조회
      const newCourse = resolveCourse(instructor, platform, filename);

      // 변경이 필요한 경우만 업데이트
      if (newCourse && newCourse !== oldCourse) {
        const { error: updateError } = await supabase
          .from("surveys")
          .update({ course: newCourse })
          .eq("id", s.id);

        if (!updateError) {
          updated++;
          results.push({ id: s.id, filename, oldCourse, newCourse });
        }
      } else {
        skipped++;
      }
    }

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
