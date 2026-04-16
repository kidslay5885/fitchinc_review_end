import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";
import type { ProcessStatus, ActionTag } from "@/lib/types";

export const maxDuration = 30;

// PATCH: 댓글 처리 상태 / action_tag 업데이트 (단건 commentId 또는 배치 commentIds 지원)
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      commentId?: string;
      commentIds?: string[];
      process_status?: ProcessStatus;
      process_memo?: string;
      important?: boolean;
      action_tag?: ActionTag;
      resolved?: boolean;
    };

    const ids = body.commentIds || (body.commentId ? [body.commentId] : []);
    if (ids.length === 0) {
      return NextResponse.json({ error: "commentId 또는 commentIds 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    const updates: Record<string, unknown> = {};

    if (body.process_status !== undefined) {
      updates.process_status = body.process_status;
      updates.processed_at = new Date().toISOString();
    }
    if (body.process_memo !== undefined) {
      updates.process_memo = body.process_memo;
    }
    if (body.important !== undefined) {
      updates.important = body.important;
    }
    if (body.action_tag !== undefined) {
      updates.action_tag = body.action_tag;
    }
    if (body.resolved !== undefined) {
      updates.resolved = body.resolved;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    const { error } = await supabase
      .from("comments")
      .update(updates)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: ids.length });
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
        resolved: false,
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

    // 해당 강사의 survey_id 목록 가져오기 (1000행 제한 우회)
    const surveys = await fetchAllRanges<{ id: string }>((from, to, withCount) => {
      let q = supabase
        .from("surveys")
        .select("id", withCount ? { count: "exact" } : undefined);
      if (platform) q = q.eq("platform", platform);
      if (instructor) q = q.eq("instructor", instructor);
      return q.range(from, to);
    });

    if (surveys.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    const surveyIds = surveys.map((s) => s.id);

    // action_tag가 있는 댓글들의 처리 통계 (1000행 제한 우회)
    const comments = await fetchAllRanges<Record<string, unknown>>((from, to, withCount) =>
      supabase
        .from("comments")
        .select("action_tag, process_status, important, resolved", withCount ? { count: "exact" } : undefined)
        .in("survey_id", surveyIds)
        .not("action_tag", "is", null)
        .range(from, to),
    );

    // 역할별 통계 집계
    const stats: Record<string, { total: number; processed: number; byStatus: Record<string, number> }> = {};

    for (const c of comments) {
      const tag = c.action_tag as string;
      if (!stats[tag]) {
        stats[tag] = { total: 0, processed: 0, byStatus: {} };
      }
      stats[tag].total++;
      if (c.process_status) {
        stats[tag].processed++;
        // 마이그레이션: no_action_needed → self_resolved (기존 DB 데이터 호환)
        const rawStatus = c.process_status as string;
        const status = rawStatus === "no_action_needed" ? "self_resolved" : rawStatus;
        stats[tag].byStatus[status] = (stats[tag].byStatus[status] || 0) + 1;
      }
    }

    return NextResponse.json({ stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "통계 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
