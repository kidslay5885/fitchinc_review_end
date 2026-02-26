import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET: 댓글 목록 조회 (surveyId 또는 platform+instructor 또는 tag 기반)
export async function GET(req: NextRequest) {
  try {
    const surveyId = req.nextUrl.searchParams.get("surveyId");
    const platform = req.nextUrl.searchParams.get("platform");
    const instructor = req.nextUrl.searchParams.get("instructor");
    const course = req.nextUrl.searchParams.get("course");
    const cohort = req.nextUrl.searchParams.get("cohort");
    const tag = req.nextUrl.searchParams.get("tag");

    const supabase = getSupabase();

    // 기존 방식: surveyId로 직접 조회
    if (surveyId) {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("survey_id", surveyId)
        .order("created_at");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // tag 기반 전체 조회: instructor 없이도 동작
    if (tag) {
      let surveyQuery = supabase
        .from("surveys")
        .select("id, platform, instructor, cohort");

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

      // tag에 맞는 comments 조회 (effectiveTag 로직 — tag 또는 source_field 기반)
      // DB에서 tag가 직접 일치하는 것 조회
      let commentsQuery = supabase
        .from("comments")
        .select("*")
        .in("survey_id", surveyIds)
        .order("created_at");

      // tag가 직접 설정된 것 + source_field 기반 자동 태그도 포함
      const { data: allComments, error: commentsError } = await commentsQuery;
      if (commentsError) {
        return NextResponse.json({ error: commentsError.message }, { status: 500 });
      }

      // effectiveTag 계산: tag ?? suggestTag(source_field)
      const suggestTag = (sourceField: string) => {
        if (sourceField === "hopePlatform") return "platform_etc";
        if (sourceField === "hopeInstructor") return "instructor";
        return null;
      };

      const filtered = (allComments || []).filter((c) => {
        const et = c.tag ?? suggestTag(c.source_field);
        return et === tag;
      });

      // survey 메타 정보 추가
      const enriched = filtered.map((c) => {
        const survey = surveyMap.get(c.survey_id);
        return {
          ...c,
          _platform: survey?.platform || "",
          _instructor: survey?.instructor || "",
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
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .in("survey_id", surveyIds)
        .order("created_at");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "surveyId 또는 platform+instructor 또는 tag 필요" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "조회 실패" },
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "저장 실패" },
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "수정 실패" },
      { status: 500 }
    );
  }
}
