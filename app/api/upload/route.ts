import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { parseXLSXToComments, parseBufferToResponses } from "@/lib/csv-parser";
import { parseFilename } from "@/lib/filename-parser";
import { resolveCourse } from "@/lib/course-registry";
import { findSchedule } from "@/lib/schedule-data";
import { suggestTag } from "@/lib/feedback-utils";
import { broadcastCommentsCreated, broadcastCommentsDeleted } from "@/lib/realtime-broadcast";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const surveyType = (formData.get("survey_type") as string) || "사전";
    const platformOverride = formData.get("platform") as string | null;
    const instructorOverride = formData.get("instructor") as string | null;
    const courseOverride = formData.get("course") as string | null;
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

    // 강의명: 수동 입력 > 레지스트리 매칭 > 파일명 파싱 순
    const course = courseOverride ?? (
      (instructor && platform)
        ? resolveCourse(instructor, platform, file.name) || parsed.course || ""
        : parsed.course ?? ""
    );

    const comments = parseXLSXToComments(buffer, isPre);
    const responses = parseBufferToResponses(buffer, isPre);

    const supabase = getSupabase();

    // 중복 설문 체크: 같은 (platform, instructor, course, cohort, survey_type) 존재 시 기존 데이터 삭제
    let replaced = false;
    let deletedCommentIds: string[] = [];
    if (platform && instructor && cohort) {
      const { data: existing } = await supabase
        .from("surveys")
        .select("id")
        .match({ platform, instructor, course, cohort, survey_type: surveyType });

      if (existing && existing.length > 0) {
        const oldIds = existing.map((s) => s.id);
        // 삭제 전에 broadcast용 댓글 id 수집
        const { data: oldComments } = await supabase
          .from("comments")
          .select("id")
          .in("survey_id", oldIds);
        deletedCommentIds = (oldComments || []).map((c) => c.id);
        // 기존 응답·코멘트·설문 삭제 (cascade 없으면 수동 삭제)
        await supabase.from("survey_responses").delete().in("survey_id", oldIds);
        await supabase.from("comments").delete().in("survey_id", oldIds);
        await supabase.from("surveys").delete().in("id", oldIds);
        replaced = true;
      }
    }

    // surveys 테이블에 저장
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        filename: file.name,
        platform,
        instructor,
        course,
        cohort,
        survey_type: surveyType,
        status: platform && instructor && cohort ? "classified" : "uploaded",
        response_count: responses.length,
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

    // 일정 데이터 자동 매칭 (pm, start_date, end_date)
    const schedule = findSchedule(platform, instructor, cohort, course);
    if (schedule) {
      await supabase
        .from("surveys")
        .update({
          pm: schedule.pm,
          start_date: schedule.startDate,
          end_date: schedule.endDate,
        })
        .eq("id", survey.id);
    }

    // comments 테이블에 저장 (응답자 이름 기준 중복 제거)
    if (comments.length > 0) {
      const commentDedup = new Map<string, typeof comments[number]>();
      for (const c of comments) {
        const key = `${c.respondent}::${c.source_field}::${c.original_text}`;
        commentDedup.set(key, c);
      }

      const commentRows = [...commentDedup.values()].map((c) => {
        const autoTag = suggestTag(c.source_field);
        return {
          survey_id: survey.id,
          respondent: c.respondent,
          original_text: c.original_text,
          source_field: c.source_field,
          sentiment: null,
          ai_summary: null,
          tag: autoTag,
          ai_classified: autoTag !== null,
        };
      });

      const { data: insertedComments, error: commentsError } = await supabase
        .from("comments")
        .insert(commentRows)
        .select();

      if (commentsError) {
        console.error("Comments insert error:", commentsError);
      } else if (insertedComments && insertedComments.length > 0) {
        // 다른 사용자에게 새 댓글 푸시 — 재업로드면 이전 삭제도 함께 반영
        // /api/classify GET이 내려주는 응답 형태와 일치시키기 위해 survey 메타데이터 부착
        const enriched = insertedComments.map((c) => ({
          ...c,
          _platform: platform || "",
          _instructor: instructor || "",
          _course: course || "",
          _cohort: cohort || "",
        }));
        if (deletedCommentIds.length > 0) {
          await broadcastCommentsDeleted(deletedCommentIds);
        }
        await broadcastCommentsCreated(enriched);
      }
    } else if (deletedCommentIds.length > 0) {
      // 댓글이 새로 안 들어왔지만 기존 것은 지웠을 때 (드물지만 가능)
      await broadcastCommentsDeleted(deletedCommentIds);
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
      replaced,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "업로드 실패";
    console.error("Upload error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
