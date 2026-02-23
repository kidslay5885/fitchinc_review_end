import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { parseXLSXToComments, parseBufferToResponses, countRespondents } from "@/lib/csv-parser";
import { parseFilename } from "@/lib/filename-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const surveyType = (formData.get("survey_type") as string) || "사전";
    const platformOverride = formData.get("platform") as string | null;
    const instructorOverride = formData.get("instructor") as string | null;
    const cohortOverride = formData.get("cohort") as string | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const isPre = surveyType === "사전";

    const parsed = parseFilename(file.name);

    const platform = platformOverride || parsed.platform || null;
    const instructor = instructorOverride || parsed.instructor || null;
    const cohort = cohortOverride || parsed.cohort || null;

    const responseCount = countRespondents(buffer);
    const comments = parseXLSXToComments(buffer, isPre);
    const responses = parseBufferToResponses(buffer, isPre);

    const supabase = getSupabase();

    // surveys 테이블에 저장
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        filename: file.name,
        platform,
        instructor,
        cohort,
        survey_type: surveyType,
        status: platform && instructor && cohort ? "classified" : "uploaded",
        response_count: responseCount,
      })
      .select()
      .single();

    if (surveyError) {
      console.error("Survey insert error:", surveyError);
      return NextResponse.json(
        { error: "설문 저장 실패: " + surveyError.message },
        { status: 500 }
      );
    }

    // comments 테이블에 저장
    if (comments.length > 0) {
      const commentRows = comments.map((c) => ({
        survey_id: survey.id,
        respondent: c.respondent,
        original_text: c.original_text,
        source_field: c.source_field,
        sentiment: null,
        ai_summary: null,
      }));

      const { error: commentsError } = await supabase
        .from("comments")
        .insert(commentRows);

      if (commentsError) {
        console.error("Comments insert error:", commentsError);
      }
    }

    // survey_responses 테이블에 전체 응답 데이터 저장
    if (responses.length > 0) {
      const responseRows = responses.map((r) => ({
        survey_id: survey.id,
        name: r.name,
        gender: r.gender,
        age: r.age,
        job: r.job,
        hours: r.hours,
        channel: r.channel,
        computer: r.computer,
        goal: r.goal,
        hope_platform: r.hopePlatform,
        hope_instructor: r.hopeInstructor,
        ps1: r.ps1,
        ps2: r.ps2,
        p_sat: r.pSat,
        p_fmt: r.pFmt,
        p_free: r.pFree,
        p_rec: r.pRec,
        raw_data: r.rawData,
      }));

      // 배치 삽입 (50개씩)
      for (let i = 0; i < responseRows.length; i += 50) {
        const batch = responseRows.slice(i, i + 50);
        const { error: respError } = await supabase
          .from("survey_responses")
          .insert(batch);

        if (respError) {
          console.error("Response insert error:", respError);
        }
      }
    }

    return NextResponse.json({
      survey,
      commentCount: comments.length,
      responseCount: responses.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "업로드 실패";
    console.error("Upload error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
