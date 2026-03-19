import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { responseToDbRow, extractCommentsFromResponse } from "@/lib/form-utils";
import { findSchedule } from "@/lib/schedule-data";
import { suggestTag } from "@/lib/feedback-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, answers } = body;

    if (!token || !answers) {
      return NextResponse.json({ error: "토큰과 응답 데이터가 필요합니다" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. 폼 조회 + 활성 상태 확인
    const { data: form, error: formError } = await supabase
      .from("survey_forms")
      .select("*")
      .eq("token", token)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: "설문 폼을 찾을 수 없습니다" }, { status: 404 });
    }

    if (!form.is_active) {
      return NextResponse.json({ error: "이 설문은 마감되었습니다" }, { status: 400 });
    }

    const { platform, instructor, course, cohort, survey_type } = form;
    const isPre = survey_type === "사전";

    // 2. 기존 surveys 행 탐색 또는 생성
    let surveyId: string;

    const { data: existingSurveys } = await supabase
      .from("surveys")
      .select("id, response_count")
      .match({ platform, instructor, course, cohort, survey_type });

    if (existingSurveys && existingSurveys.length > 0) {
      surveyId = existingSurveys[0].id;
    } else {
      const filename = `[웹설문] ${platform} ${instructor} ${cohort} ${survey_type}`;
      const { data: newSurvey, error: surveyError } = await supabase
        .from("surveys")
        .insert({
          filename,
          platform,
          instructor,
          course,
          cohort,
          survey_type,
          status: "classified",
          response_count: 0,
        })
        .select()
        .single();

      if (surveyError || !newSurvey) {
        return NextResponse.json({ error: "설문 생성 실패" }, { status: 500 });
      }

      surveyId = newSurvey.id;

      // 일정 자동 매칭
      const schedule = findSchedule(platform, instructor, cohort, course);
      if (schedule) {
        await supabase
          .from("surveys")
          .update({
            pm: schedule.pm,
            start_date: schedule.startDate,
            end_date: schedule.endDate,
          })
          .eq("id", surveyId);
      }
    }

    // 3. survey_responses INSERT
    const respondentName = (answers.name || "").trim() || `웹응답자`;
    const dbRow = responseToDbRow(answers, surveyId, isPre, 0);

    const { error: respError } = await supabase
      .from("survey_responses")
      .insert(dbRow);

    if (respError) {
      console.error("Response insert error:", respError);
      return NextResponse.json({ error: "응답 저장 실패" }, { status: 500 });
    }

    // 4. 댓글 추출 + INSERT
    const comments = extractCommentsFromResponse(answers, respondentName, isPre);

    if (comments.length > 0) {
      const commentRows = comments.map((c) => {
        const autoTag = suggestTag(c.source_field);
        return {
          survey_id: surveyId,
          respondent: c.respondent,
          original_text: c.original_text,
          source_field: c.source_field,
          sentiment: null,
          ai_summary: null,
          tag: autoTag,
          ai_classified: autoTag !== null,
        };
      });

      const { error: commentsError } = await supabase
        .from("comments")
        .insert(commentRows);

      if (commentsError) {
        console.error("Comments insert error:", commentsError);
      }
    }

    // 5. response_count 증분 (atomic)
    const { error: rpcError } = await supabase.rpc("increment_response_count", { survey_id_param: surveyId });
    if (rpcError) {
      // RPC가 없으면 수동 업데이트
      const { data: current } = await supabase
        .from("surveys")
        .select("response_count")
        .eq("id", surveyId)
        .single();
      if (current) {
        await supabase
          .from("surveys")
          .update({ response_count: (current.response_count || 0) + 1 })
          .eq("id", surveyId);
      }
    }

    return NextResponse.json({ ok: true, surveyId, commentCount: comments.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "제출 실패";
    console.error("Submit error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
