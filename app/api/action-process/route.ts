import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { ProcessStatus, ActionTag } from "@/lib/types";

export const maxDuration = 30;

// PATCH: 댓글 처리 상태 / action_tag 업데이트
export async function PATCH(req: NextRequest) {
  try {
    const { commentId, process_status, process_memo, important, action_tag } = (await req.json()) as {
      commentId: string;
      process_status?: ProcessStatus;
      process_memo?: string;
      important?: boolean;
      action_tag?: ActionTag;
    };

    if (!commentId) {
      return NextResponse.json({ error: "commentId 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    const updates: Record<string, unknown> = {};

    if (process_status !== undefined) {
      updates.process_status = process_status;
      updates.processed_at = new Date().toISOString();
    }
    if (process_memo !== undefined) {
      updates.process_memo = process_memo;
    }
    if (important !== undefined) {
      updates.important = important;
    }
    if (action_tag !== undefined) {
      updates.action_tag = action_tag;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    const { error } = await supabase
      .from("comments")
      .update(updates)
      .eq("id", commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "처리 상태 업데이트 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: 처리 상태 초기화 (되돌리기)
export async function DELETE(req: NextRequest) {
  try {
    const { commentId } = (await req.json()) as { commentId: string };

    if (!commentId) {
      return NextResponse.json({ error: "commentId 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("comments")
      .update({
        process_status: null,
        process_memo: "",
        processed_at: null,
      })
      .eq("id", commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "처리 초기화 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: scope_key별 처리 통계
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const instructor = searchParams.get("instructor");

    const supabase = getSupabase();

    // 해당 강사의 survey_id 목록 가져오기
    let surveyQuery = supabase
      .from("surveys")
      .select("id");

    if (platform) surveyQuery = surveyQuery.eq("platform", platform);
    if (instructor) surveyQuery = surveyQuery.eq("instructor", instructor);

    const { data: surveys, error: surveyError } = await surveyQuery;
    if (surveyError) {
      return NextResponse.json({ error: surveyError.message }, { status: 500 });
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    const surveyIds = surveys.map((s) => s.id);

    // action_tag가 있는 댓글들의 처리 통계
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select("action_tag, process_status, important")
      .in("survey_id", surveyIds)
      .not("action_tag", "is", null);

    if (commentsError) {
      return NextResponse.json({ error: commentsError.message }, { status: 500 });
    }

    // 역할별 통계 집계
    const stats: Record<string, { total: number; processed: number; important: number; byStatus: Record<string, number> }> = {};

    for (const c of comments || []) {
      const tag = c.action_tag as string;
      if (!stats[tag]) {
        stats[tag] = { total: 0, processed: 0, important: 0, byStatus: {} };
      }
      stats[tag].total++;
      if (c.process_status) {
        stats[tag].processed++;
        stats[tag].byStatus[c.process_status] = (stats[tag].byStatus[c.process_status] || 0) + 1;
      }
      if (c.important) {
        stats[tag].important++;
      }
    }

    return NextResponse.json({ stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "통계 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
