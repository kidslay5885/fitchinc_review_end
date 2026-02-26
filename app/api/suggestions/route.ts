import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const TABLE = "app_settings";

function suggestionKey(id: string) {
  return `suggestion:${id}`;
}

/** GET: 모든 건의사항 조회 (최신순) */
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select("key, value")
      .like("key", "suggestion:%");

    if (error) {
      console.error("suggestions GET error:", error.message);
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = (data || [])
      .map((row) => {
        const id = (row.key as string).replace("suggestion:", "");
        const v = row.value as { content?: string; createdAt?: string; status?: string };
        return {
          id,
          content: v.content || "",
          createdAt: v.createdAt || "",
          status: v.status || "pending",
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.warn("suggestions GET error:", e);
    return NextResponse.json({ suggestions: [] });
  }
}

/** POST: 새 건의사항 등록 */
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "내용을 입력해주세요" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const key = suggestionKey(id);
    const value = {
      content: content.trim(),
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    const supabase = getSupabase();
    const { error } = await supabase.from(TABLE).upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    if (error) {
      console.error("suggestions POST error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.warn("suggestions POST error:", e);
    return NextResponse.json({ ok: false, error: "저장 실패" }, { status: 500 });
  }
}

/** PATCH: 건의사항 상태 변경 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !["pending", "reviewed"].includes(status)) {
      return NextResponse.json({ ok: false, error: "id, status 필요" }, { status: 400 });
    }

    const key = suggestionKey(id);
    const supabase = getSupabase();

    const { data, error: getError } = await supabase
      .from(TABLE)
      .select("value")
      .eq("key", key)
      .single();

    if (getError || !data) {
      return NextResponse.json({ ok: false, error: "건의사항을 찾을 수 없습니다" }, { status: 404 });
    }

    const value = { ...(data.value as Record<string, unknown>), status };
    const { error } = await supabase.from(TABLE).upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    if (error) {
      console.error("suggestions PATCH error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn("suggestions PATCH error:", e);
    return NextResponse.json({ ok: false, error: "업데이트 실패" }, { status: 500 });
  }
}

/** DELETE: 건의사항 삭제 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id 필요" }, { status: 400 });
    }

    const key = suggestionKey(id);
    const supabase = getSupabase();
    const { error } = await supabase.from(TABLE).delete().eq("key", key);

    if (error) {
      console.error("suggestions DELETE error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn("suggestions DELETE error:", e);
    return NextResponse.json({ ok: false, error: "삭제 실패" }, { status: 500 });
  }
}
