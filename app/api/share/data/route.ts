import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const APP_SETTINGS_TABLE = "app_settings";

// GET: 토큰 기반 공유 데이터 조회 (강사 공유 페이지용)
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "token 필수" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1) 토큰 검증
    const { data: shareLink } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", token)
      .single();

    if (!shareLink) {
      return NextResponse.json({ error: "유효하지 않은 토큰" }, { status: 404 });
    }

    // 만료 확인
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json({ error: "만료된 링크" }, { status: 410 });
    }

    // 2) 필터 조건으로 설문 조회
    let surveyQuery = supabase
      .from("surveys")
      .select("id, survey_type, platform, instructor, cohort, course");

    if (shareLink.filter_platform) {
      surveyQuery = surveyQuery.eq("platform", shareLink.filter_platform);
    }
    if (shareLink.filter_instructor) {
      surveyQuery = surveyQuery.eq("instructor", shareLink.filter_instructor);
    }
    if (shareLink.filter_cohort) {
      surveyQuery = surveyQuery.eq("cohort", shareLink.filter_cohort);
    }
    if (shareLink.filter_course) {
      surveyQuery = surveyQuery.eq("course", shareLink.filter_course);
    }

    const { data: surveys, error: surveyError } = await surveyQuery;
    if (surveyError) {
      return NextResponse.json({ error: surveyError.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ preResponses: [], postResponses: [], comments: [], cohorts: [], instructorPhoto: null });
    }

    const preSurveyIds = surveys.filter((s) => s.survey_type === "사전").map((s) => s.id);
    const postSurveyIds = surveys.filter((s) => s.survey_type === "후기").map((s) => s.id);
    const allSurveyIds = surveys.map((s) => s.id);

    // 기수 목록 추출 (해당 강사의 전체 기수)
    const cohortSet = new Set<string>();
    for (const s of surveys) {
      if (s.cohort) cohortSet.add(s.cohort);
    }
    const cohorts = [...cohortSet].sort((a, b) => {
      const numA = parseInt((a || "").replace(/\D/g, "")) || 0;
      const numB = parseInt((b || "").replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    // rawData 정규화
    const normalizeRawData = (raw: unknown): Record<string, string> => {
      if (!raw || typeof raw !== "object") return {};
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v == null) continue;
        if (typeof v === "object") continue;
        result[k] = String(v);
      }
      return result;
    };

    // 3) 응답 데이터 조회
    const fetchResponses = async (ids: string[]) => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .in("survey_id", ids)
        .order("created_at");
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        name: "", // 개인정보 보호: 이름 비공개
        gender: String(r.gender ?? ""),
        age: String(r.age ?? ""),
        job: String(r.job ?? ""),
        hours: String(r.hours ?? ""),
        channel: String(r.channel ?? ""),
        computer: Number(r.computer) || 0,
        goal: String(r.goal ?? ""),
        hopePlatform: String(r.hope_platform ?? ""),
        hopeInstructor: String(r.hope_instructor ?? ""),
        ps1: Number(r.ps1) || 0,
        ps2: Number(r.ps2) || 0,
        pSat: String(r.p_sat ?? ""),
        pFmt: String(r.p_fmt ?? ""),
        pFree: String(r.p_free ?? ""),
        pRec: String(r.p_rec ?? ""),
        rawData: normalizeRawData(r.raw_data),
      }));
    };

    // 4) 숨긴 댓글 목록 + 강사 프로필 사진 조회
    const fetchAppSettings = async () => {
      let hiddenComments: string[] = [];
      let instructorPhoto: { photo: string; photoPosition: string } | null = null;

      const keysToFetch = ["hidden_comments"];
      if (shareLink.filter_platform && shareLink.filter_instructor) {
        keysToFetch.push(`instructor_photo:${shareLink.filter_platform}:${shareLink.filter_instructor}`);
      }

      const { data, error } = await supabase
        .from(APP_SETTINGS_TABLE)
        .select("key, value")
        .in("key", keysToFetch);

      if (!error && data) {
        for (const row of data) {
          if (row.key === "hidden_comments" && Array.isArray(row.value)) {
            hiddenComments = row.value.filter((x: unknown) => typeof x === "string");
          } else if (row.key.startsWith("instructor_photo:") && row.value && typeof row.value === "object") {
            const v = row.value as { photo?: string; photoPosition?: string };
            if (v.photo) {
              instructorPhoto = {
                photo: typeof v.photo === "string" ? v.photo : "",
                photoPosition: typeof v.photoPosition === "string" ? v.photoPosition : "center 2%",
              };
            }
          }
        }
      }

      return { hiddenComments, instructorPhoto };
    };

    // 5) 강사 태그 댓글 조회
    const fetchInstructorComments = async () => {
      if (allSurveyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("id, original_text, sentiment, source_field, tag")
        .in("survey_id", allSurveyIds)
        .eq("tag", "instructor")
        .neq("source_field", "hopePlatform") // 플랫폼 피드백 제외
        .order("created_at");
      if (error) throw error;
      return (data || []).map((c) => ({
        id: c.id,
        original_text: c.original_text,
        sentiment: c.sentiment,
        source_field: c.source_field,
      }));
    };

    const [preResponses, postResponses, rawComments, appSettings] = await Promise.all([
      fetchResponses(preSurveyIds),
      fetchResponses(postSurveyIds),
      fetchInstructorComments(),
      fetchAppSettings(),
    ]);

    // 숨긴 댓글 제외
    const hiddenSet = new Set(appSettings.hiddenComments);
    const comments = hiddenSet.size > 0
      ? rawComments.filter((c) => !hiddenSet.has(c.id))
      : rawComments;

    return NextResponse.json({
      preResponses,
      postResponses,
      comments,
      instructorPhoto: appSettings.instructorPhoto,
      cohorts,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "데이터 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
