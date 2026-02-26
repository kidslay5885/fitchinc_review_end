import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { findSchedule } from "@/lib/schedule-data";

/**
 * POST /api/backfill-schedule
 * 기존 surveys에 schedule-data.ts 기반으로 pm, start_date, end_date 일괄 적용
 */
export async function POST() {
  try {
    const supabase = getSupabase();

    const { data: surveys, error } = await supabase
      .from("surveys")
      .select("id, platform, instructor, course, cohort, pm, start_date, end_date");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ message: "설문 데이터 없음", updated: 0 });
    }

    let updated = 0;
    let skipped = 0;

    for (const s of surveys) {
      const schedule = findSchedule(s.platform, s.instructor, s.cohort, s.course);
      if (!schedule) {
        skipped++;
        continue;
      }

      // 이미 동일한 값이면 스킵
      if (s.pm === schedule.pm && s.start_date === schedule.startDate && s.end_date === schedule.endDate) {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("surveys")
        .update({
          pm: schedule.pm,
          start_date: schedule.startDate,
          end_date: schedule.endDate,
        })
        .eq("id", s.id);

      if (!updateError) updated++;
    }

    return NextResponse.json({
      message: `스케줄 백필 완료: ${updated}건 업데이트, ${skipped}건 스킵`,
      updated,
      skipped,
      total: surveys.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "백필 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
