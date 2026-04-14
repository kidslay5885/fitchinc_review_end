import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase 1000행 제한 우회 — 페이지네이션으로 전체 조회
// 순차 페이징: queryBuilder를 재사용해 페이지를 차례로 요청
async function fetchAll(
  queryBuilder: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>
) {
  const PAGE = 1000;
  let all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as Record<string, unknown>[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// 병렬 페이지네이션 — 첫 페이지에서 count를 받아 필요한 페이지만 병렬 요청
// buildCountQuery/buildQuery: 호출마다 "같은 필터의 새 쿼리 빌더"를 반환해야 함
async function fetchAllParallel(
  buildCountQuery: () => ReturnType<ReturnType<SupabaseClient["from"]>["select"]>,
  buildQuery: () => ReturnType<ReturnType<SupabaseClient["from"]>["select"]>
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  // 1) 첫 페이지 + exact count 동시 조회
  const first = await buildCountQuery().range(0, PAGE - 1);
  if (first.error) throw first.error;
  const firstRows = (first.data as Record<string, unknown>[]) || [];
  const total = typeof first.count === "number" ? first.count : firstRows.length;
  if (total <= PAGE) return firstRows;

  // 2) 남은 페이지 수만큼 정확히 병렬 요청
  const pageCount = Math.ceil(total / PAGE);
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      buildQuery().range((i + 1) * PAGE, (i + 2) * PAGE - 1)
    )
  );
  const all: Record<string, unknown>[] = [...firstRows];
  for (const r of rest) {
    if (r.error) throw r.error;
    all.push(...((r.data as Record<string, unknown>[]) || []));
  }
  return all;
}

// GET: 댓글 목록 조회 (surveyId 또는 platform+instructor 또는 tag 기반)
export async function GET(req: NextRequest) {
  try {
    const surveyId = req.nextUrl.searchParams.get("surveyId");
    const platform = req.nextUrl.searchParams.get("platform");
    const instructor = req.nextUrl.searchParams.get("instructor");
    const course = req.nextUrl.searchParams.get("course");
    const cohort = req.nextUrl.searchParams.get("cohort");
    const tag = req.nextUrl.searchParams.get("tag");
    const tagsParam = req.nextUrl.searchParams.get("tags");

    const supabase = getSupabase();

    // tag → auto-mapped source_fields 매핑
    const AUTO_FIELDS: Record<string, string[]> = {
      instructor: ["hopeInstructor", "selectReason", "satOther", "lowScoreReason", "lowFeedbackRequest"],
      platform_general: ["hopePlatform"],
      platform_etc: ["pFree"],
    };

    // 기존 방식: surveyId로 직접 조회
    if (surveyId) {
      const data = await fetchAll(
        supabase
          .from("comments")
          .select("*")
          .eq("survey_id", surveyId)
          .order("created_at")
      );
      return NextResponse.json(data);
    }

    // 배치 태그 조회: tags=a,b,c — 1회 요청으로 여러 태그 처리 (surveys 재조회 제거)
    if (tagsParam) {
      const requestedTags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
      if (requestedTags.length === 0) return NextResponse.json([]);

      let surveyQuery = supabase
        .from("surveys")
        .select("id, platform, instructor, course, cohort");
      if (platform) surveyQuery = surveyQuery.eq("platform", platform);

      const { data: surveys, error: surveyError } = await surveyQuery;
      if (surveyError) {
        return NextResponse.json({ error: surveyError.message }, { status: 500 });
      }
      if (!surveys || surveys.length === 0) return NextResponse.json([]);

      const surveyIds = surveys.map((s) => s.id);
      const surveyMap = new Map(surveys.map((s) => [s.id, s]));

      // auto_fields 합집합 (tag가 null이지만 source_field로 해당 역할에 매핑되는 댓글)
      const autoFieldSet = new Set<string>();
      for (const t of requestedTags) {
        for (const f of AUTO_FIELDS[t] || []) autoFieldSet.add(f);
      }
      const autoFields = Array.from(autoFieldSet);

      // 태그 기반 + 자동 매핑 댓글을 병렬 페이지네이션으로 조회
      const [taggedComments, autoComments] = await Promise.all([
        fetchAllParallel(
          () =>
            supabase
              .from("comments")
              .select("*", { count: "exact" })
              .in("survey_id", surveyIds)
              .in("tag", requestedTags)
              .order("created_at"),
          () =>
            supabase
              .from("comments")
              .select("*")
              .in("survey_id", surveyIds)
              .in("tag", requestedTags)
              .order("created_at")
        ),
        autoFields.length > 0
          ? fetchAllParallel(
              () =>
                supabase
                  .from("comments")
                  .select("*", { count: "exact" })
                  .in("survey_id", surveyIds)
                  .is("tag", null)
                  .in("source_field", autoFields)
                  .order("created_at"),
              () =>
                supabase
                  .from("comments")
                  .select("*")
                  .in("survey_id", surveyIds)
                  .is("tag", null)
                  .in("source_field", autoFields)
                  .order("created_at")
            )
          : Promise.resolve([] as Record<string, unknown>[]),
      ]);

      // id 기준 dedup + survey 메타 부착
      const seen = new Set<string>();
      const enriched: Record<string, unknown>[] = [];
      for (const c of [...taggedComments, ...autoComments]) {
        const id = c.id as string;
        if (seen.has(id)) continue;
        seen.add(id);
        const survey = surveyMap.get(c.survey_id as string);
        enriched.push({
          ...c,
          _platform: survey?.platform || "",
          _instructor: survey?.instructor || "",
          _course: survey?.course || "",
          _cohort: survey?.cohort || "",
        });
      }
      return NextResponse.json(enriched);
    }

    // tag 기반 전체 조회: instructor 없이도 동작
    if (tag) {
      let surveyQuery = supabase
        .from("surveys")
        .select("id, platform, instructor, course, cohort");

      if (platform) {
        surveyQuery = surveyQuery.eq("platform", platform);
      }

      const { data: surveys, error: surveyError } = await surveyQuery;
      if (surveyError) {
        return NextResponse.json({ error: surveyError.message }, { status: 500 });
      }

      if (!surveys || surveys.length === 0) {
        return NextResponse.json([]);
      }

      const surveyIds = surveys.map((s) => s.id);
      const surveyMap = new Map(surveys.map((s) => [s.id, s]));

      // 1) tag가 직접 설정된 댓글 조회
      const taggedComments = await fetchAll(
        supabase
          .from("comments")
          .select("*")
          .in("survey_id", surveyIds)
          .eq("tag", tag)
          .order("created_at")
      );

      // 2) tag가 null이지만 source_field로 자동 매핑되는 댓글 조회
      const autoFields = AUTO_FIELDS[tag] || [];
      let autoComments: Record<string, unknown>[] = [];
      if (autoFields.length > 0) {
        autoComments = await fetchAll(
          supabase
            .from("comments")
            .select("*")
            .in("survey_id", surveyIds)
            .is("tag", null)
            .in("source_field", autoFields)
            .order("created_at")
        );
      }

      const filtered = [...taggedComments, ...autoComments];

      // survey 메타 정보 추가
      const enriched = filtered.map((c) => {
        const survey = surveyMap.get(c.survey_id);
        return {
          ...c,
          _platform: survey?.platform || "",
          _instructor: survey?.instructor || "",
          _course: survey?.course || "",
          _cohort: survey?.cohort || "",
        };
      });

      return NextResponse.json(enriched);
    }

    // 새 방식: platform + instructor로 조회 (course, cohort 선택)
    if (platform && instructor) {
      let surveyQuery = supabase
        .from("surveys")
        .select("id")
        .eq("platform", platform)
        .eq("instructor", instructor);

      if (course != null) {
        surveyQuery = surveyQuery.eq("course", course);
      }

      if (cohort) {
        surveyQuery = surveyQuery.eq("cohort", cohort);
      }

      const { data: surveys, error: surveyError } = await surveyQuery;
      if (surveyError) {
        return NextResponse.json({ error: surveyError.message }, { status: 500 });
      }

      if (!surveys || surveys.length === 0) {
        return NextResponse.json([]);
      }

      const surveyIds = surveys.map((s) => s.id);
      const data = await fetchAll(
        supabase
          .from("comments")
          .select("*")
          .in("survey_id", surveyIds)
          .order("created_at")
      );

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "surveyId 또는 platform+instructor 또는 tag 필요" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

// POST: 설문 메타데이터(플랫폼/강사/기수) 저장
export async function POST(req: NextRequest) {
  try {
    const { surveyId, platform, instructor, cohort } = await req.json();

    const supabase = getSupabase();
    const { error } = await supabase
      .from("surveys")
      .update({
        platform,
        instructor,
        cohort,
        status: "classified",
      })
      .eq("id", surveyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "저장 실패";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

// PATCH: 개별 댓글의 sentiment 또는 tag 변경 (ai_classified 플래그 포함)
export async function PATCH(req: NextRequest) {
  try {
    const { commentId, sentiment, tag, ai_classified } = await req.json();

    const updates: Record<string, unknown> = {};
    if (sentiment !== undefined) updates.sentiment = sentiment;
    if (tag !== undefined) updates.tag = tag;
    if (ai_classified !== undefined) updates.ai_classified = ai_classified;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    const supabase = getSupabase();
    let { error } = await supabase
      .from("comments")
      .update(updates)
      .eq("id", commentId);

    // ai_classified 컬럼이 없으면 해당 필드 제외 후 재시도
    if (error && ai_classified !== undefined) {
      delete updates.ai_classified;
      if (Object.keys(updates).length > 0) {
        const retry = await supabase.from("comments").update(updates).eq("id", commentId);
        error = retry.error;
      } else {
        error = null;
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "수정 실패";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
