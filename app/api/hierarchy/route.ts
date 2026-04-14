import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";

export async function GET() {
  try {
    const supabase = getSupabase();

    const surveys = await fetchAllRanges<Record<string, unknown>>((from, to, withCount) =>
      supabase
        .from("surveys")
        .select(
          "platform, instructor, course, cohort, survey_type, response_count, pm, start_date, end_date, total_students",
          withCount ? { count: "exact" } : undefined,
        )
        .not("platform", "is", null)
        .not("instructor", "is", null)
        .order("created_at")
        .range(from, to),
    );

    // 4단계 계층 빌드: platform → instructor → course → cohort
    // Map<platform, Map<instructor, Map<course, Set<cohort>>>>
    const platformMap = new Map<string, Map<string, Map<string, Set<string>>>>();
    const cohortMeta = new Map<string, { pm: string; startDate: string | null; endDate: string | null; totalStudents: number; preCount: number; postCount: number; hasPreSurvey: boolean; hasPostSurvey: boolean }>();

    for (const s of surveys as Array<{
      platform: string | null;
      instructor: string | null;
      course: string | null;
      cohort: string | null;
      survey_type: string | null;
      response_count: number | null;
      pm: string | null;
      start_date: string | null;
      end_date: string | null;
      total_students: number | null;
    }>) {
      if (!s.platform || !s.instructor) continue;

      const courseName = s.course || "";

      if (!platformMap.has(s.platform)) {
        platformMap.set(s.platform, new Map());
      }
      const instMap = platformMap.get(s.platform)!;

      if (!instMap.has(s.instructor)) {
        instMap.set(s.instructor, new Map());
      }
      const courseMap = instMap.get(s.instructor)!;

      if (!courseMap.has(courseName)) {
        courseMap.set(courseName, new Set());
      }

      if (s.cohort) {
        courseMap.get(courseName)!.add(s.cohort);

        const key = `${s.platform}|${s.instructor}|${courseName}|${s.cohort}`;
        const existing = cohortMeta.get(key) || { pm: "", startDate: null, endDate: null, totalStudents: 0, preCount: 0, postCount: 0, hasPreSurvey: false, hasPostSurvey: false };

        if (s.pm) existing.pm = s.pm;
        if (s.start_date) existing.startDate = s.start_date;
        if (s.end_date) existing.endDate = s.end_date;
        if (s.total_students) existing.totalStudents = s.total_students;

        if (s.survey_type === "사전") {
          existing.hasPreSurvey = true;
          existing.preCount += s.response_count || 0;
        } else {
          existing.hasPostSurvey = true;
          existing.postCount += s.response_count || 0;
        }

        cohortMeta.set(key, existing);
      }
    }

    // 출력 형태
    const result = Array.from(platformMap.entries()).map(([platformName, instMap]) => ({
      name: platformName,
      instructors: Array.from(instMap.entries()).map(([instName, courseMap]) => ({
        name: instName,
        courses: Array.from(courseMap.entries()).map(([courseName, cohortSet]) => ({
          name: courseName,
          cohorts: Array.from(cohortSet).map((cohortLabel) => {
            const key = `${platformName}|${instName}|${courseName}|${cohortLabel}`;
            const meta = cohortMeta.get(key);
            return {
              label: cohortLabel,
              pm: meta?.pm || "",
              startDate: meta?.startDate || "",
              endDate: meta?.endDate || "",
              totalStudents: meta?.totalStudents || 0,
              preCount: meta?.preCount || 0,
              postCount: meta?.postCount || 0,
              hasPreSurvey: meta?.hasPreSurvey || false,
              hasPostSurvey: meta?.hasPostSurvey || false,
            };
          }),
        })),
      })),
    }));

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "계층 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
