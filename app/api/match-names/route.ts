import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** POST: 전화번호 기반 이름 매칭 (미리보기) */
export async function POST(req: NextRequest) {
  try {
    const { entries } = (await req.json()) as {
      entries: { name: string; phone: string }[];
    };

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "entries 필요" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 전화번호 정규화
    const normalize = (p: string) => p.replace(/\D/g, "");
    const phoneToName = new Map<string, string>();
    for (const e of entries) {
      const digits = normalize(e.phone);
      if (digits.length >= 10) phoneToName.set(digits, e.name.trim());
    }

    // 전화번호가 있는 응답 전체 조회 (이름이 비어있거나 의심스러운 것)
    const PAGE = 1000;
    const all: Record<string, unknown>[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, name, phone, survey_id")
        .neq("phone", "")
        .not("phone", "is", null)
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    // 매칭 결과
    const matches: {
      responseId: string;
      currentName: string;
      matchedName: string;
      phone: string;
    }[] = [];

    for (const r of all) {
      const digits = normalize(r.phone as string);
      const matchedName = phoneToName.get(digits);
      if (!matchedName) continue;

      const currentName = (r.name as string) || "";
      // 이름이 없거나 다른 경우만
      if (!currentName || currentName !== matchedName) {
        matches.push({
          responseId: r.id as string,
          currentName,
          matchedName,
          phone: r.phone as string,
        });
      }
    }

    return NextResponse.json({ matches, totalChecked: all.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "매칭 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH: 매칭된 이름 일괄 업데이트 */
export async function PATCH(req: NextRequest) {
  try {
    const { updates } = (await req.json()) as {
      updates: { responseId: string; name: string }[];
    };

    if (!updates || updates.length === 0) {
      return NextResponse.json({ error: "updates 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    let updated = 0;

    for (const u of updates) {
      const { error } = await supabase
        .from("survey_responses")
        .update({ name: u.name })
        .eq("id", u.responseId);
      if (!error) updated++;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "업데이트 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
