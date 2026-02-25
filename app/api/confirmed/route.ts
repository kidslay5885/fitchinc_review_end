import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const TABLE = "app_settings";
const PREFIX = "confirmed:";

// GET: 확인 완료된 comment ID 목록 반환
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select("key")
      .like("key", `${PREFIX}%`);

    if (error) {
      console.error("confirmed GET error:", error.message);
      return NextResponse.json([]);
    }

    const ids = (data || []).map((row) => (row.key as string).slice(PREFIX.length));
    return NextResponse.json(ids);
  } catch {
    return NextResponse.json([]);
  }
}

// POST: 확인 완료 등록 (단건 또는 복수)
export async function POST(req: NextRequest) {
  try {
    const { commentIds } = await req.json();
    const ids: string[] = Array.isArray(commentIds) ? commentIds : [commentIds];

    const supabase = getSupabase();
    const rows = ids.map((id) => ({
      key: `${PREFIX}${id}`,
      value: { confirmed: true },
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE: 확인 완료 해제
export async function DELETE(req: NextRequest) {
  try {
    const { commentIds } = await req.json();
    const ids: string[] = Array.isArray(commentIds) ? commentIds : [commentIds];

    const supabase = getSupabase();
    const keys = ids.map((id) => `${PREFIX}${id}`);
    const { error } = await supabase.from(TABLE).delete().in("key", keys);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
