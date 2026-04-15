import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** 기프티쇼 발송 상태 토글 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { responseIds, gift_sent, gift_amount } = body;

    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return NextResponse.json({ error: "responseIds가 필요합니다" }, { status: 400 });
    }

    const supabase = getSupabase();
    const updateData: Record<string, unknown> = {};

    // 발송 상태 토글
    if (typeof gift_sent === "boolean") {
      updateData.gift_sent = gift_sent;
      updateData.gift_sent_at = gift_sent ? new Date().toISOString() : null;
    }

    // 금액 일괄 수정
    if (typeof gift_amount === "number") {
      updateData.gift_amount = gift_amount;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "업데이트할 항목이 없습니다" }, { status: 400 });
    }

    const { error } = await supabase
      .from("survey_responses")
      .update(updateData)
      .in("id", responseIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: responseIds.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "업데이트 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
