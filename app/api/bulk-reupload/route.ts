import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { parseXLSXToComments, parseBufferToResponses } from "@/lib/csv-parser";
import { parseFilename } from "@/lib/filename-parser";
import { resolveCourse } from "@/lib/course-registry";
import { findSchedule } from "@/lib/schedule-data";
import { suggestTag } from "@/lib/feedback-utils";
import * as fs from "fs";
import * as path from "path";

const XLSX_DIR = String.raw`C:\Users\핏크닉\Desktop\정승희\3. 수강생 만족도조사\완료`;

interface FileResult {
  filename: string;
  oldResponseCount: number | null;
  newResponseCount: number;
  commentCount: number;
  diff: number | null;
  replaced: boolean;
  error?: string;
}

export async function POST() {
  const results: FileResult[] = [];
  let processed = 0;
  let errors = 0;

  // 디렉토리에서 모든 XLSX 파일 읽기
  let files: string[];
  try {
    const allFiles = fs.readdirSync(XLSX_DIR);
    files = allFiles.filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith("~$"));
  } catch (e) {
    return NextResponse.json(
      { error: `디렉토리 읽기 실패: ${XLSX_DIR}`, detail: String(e) },
      { status: 500 }
    );
  }

  const supabase = getSupabase();

  for (const filename of files) {
    try {
      const filePath = path.join(XLSX_DIR, filename);
      const fileBuffer = fs.readFileSync(filePath);
      const buffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );

      // 파일명에서 설문 유형 판별
      const parsed = parseFilename(filename);
      const surveyType = parsed.type === "후기" ? "후기" : "사전";
      const isPre = surveyType === "사전";

      const platform = parsed.platform || null;
      const instructor = parsed.instructor || null;
      const cohort = parsed.cohort || null;
      const course =
        instructor && platform
          ? resolveCourse(instructor, platform, filename) || parsed.course || ""
          : parsed.course ?? "";

      const comments = parseXLSXToComments(buffer, isPre);
      const responses = parseBufferToResponses(buffer, isPre);

      // 기존 설문 조회 (이전 응답 수 확인용)
      let oldResponseCount: number | null = null;
      let replaced = false;

      if (platform && instructor && cohort) {
        const { data: existing } = await supabase
          .from("surveys")
          .select("id, response_count")
          .match({ platform, instructor, course, cohort, survey_type: surveyType });

        if (existing && existing.length > 0) {
          oldResponseCount = existing[0].response_count;
          const oldIds = existing.map((s) => s.id);
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
          filename,
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
        results.push({
          filename,
          oldResponseCount,
          newResponseCount: responses.length,
          commentCount: comments.length,
          diff: null,
          replaced,
          error: surveyError.message,
        });
        errors++;
        continue;
      }

      // 일정 데이터 자동 매칭
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

      // comments 저장 (복합키 중복 제거)
      if (comments.length > 0) {
        const commentDedup = new Map<string, (typeof comments)[number]>();
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

        const { error: commentsError } = await supabase
          .from("comments")
          .insert(commentRows);

        if (commentsError) {
          console.error(`Comments insert error for ${filename}:`, commentsError);
        }
      }

      // survey_responses 저장 (50개씩 배치)
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

        for (let i = 0; i < responseRows.length; i += 50) {
          const batch = responseRows.slice(i, i + 50);
          const { error: respError } = await supabase
            .from("survey_responses")
            .insert(batch);

          if (respError) {
            console.error(`Response insert error for ${filename}:`, respError);
          }
        }
      }

      const diff = oldResponseCount !== null ? responses.length - oldResponseCount : null;
      results.push({
        filename,
        oldResponseCount,
        newResponseCount: responses.length,
        commentCount: comments.length,
        diff,
        replaced,
      });
      processed++;
    } catch (e) {
      results.push({
        filename,
        oldResponseCount: null,
        newResponseCount: 0,
        commentCount: 0,
        diff: null,
        replaced: false,
        error: String(e),
      });
      errors++;
    }
  }

  // 불일치 건 필터
  const mismatches = results.filter((r) => r.diff !== null && r.diff !== 0);

  return NextResponse.json({
    totalFiles: files.length,
    processed,
    errors,
    mismatches: mismatches.length,
    results,
  });
}
