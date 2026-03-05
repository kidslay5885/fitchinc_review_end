import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "@/lib/supabase";
import { TAG_TO_AI_LABEL } from "@/lib/action-utils";
import type { ActionTag } from "@/lib/types";

export const maxDuration = 120;

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

async function assignThemes(
  ai: ReturnType<typeof getAI>,
  tagLabel: string,
  comments: { id: string; original_text: string }[]
): Promise<{ themes: { name: string; indices: number[] }[] }> {
  const sample = comments.slice(0, 200);

  const prompt = `다음은 "${tagLabel}" 담당자가 처리해야 할 설문 댓글 ${sample.length}건입니다.

## 작업
1. 비슷한 내용끼리 테마로 묶으세요.
2. 각 댓글이 어떤 테마에 속하는지 index로 매핑하세요.

## 규칙
- 테마 최대 15개
- 3건 미만 소수 의견은 "기타"로 합치기

## 댓글
${sample.map((c, i) => `[${i}] ${c.original_text}`).join("\n")}

## JSON 출력 형식
{"themes":[{"name":"테마명","indices":[0,3,7]},...]}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const text = response.text || "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { themes: [] };
  }
}

// POST: scope_key + action_tag + comments → 테마 생성
export async function POST(req: NextRequest) {
  try {
    const { scope_key, action_tag, comments } = (await req.json()) as {
      scope_key: string;
      action_tag: ActionTag;
      comments: { id: string; original_text: string }[];
    };

    if (!scope_key || !action_tag || !comments?.length) {
      return NextResponse.json({ error: "scope_key, action_tag, comments 필요" }, { status: 400 });
    }

    const ai = getAI();
    const supabase = getSupabase();
    const tagLabel = TAG_TO_AI_LABEL[action_tag] || action_tag;

    const result = await assignThemes(ai, tagLabel, comments);
    const themes = result.themes || [];

    // 기존 테마 삭제 후 재생성
    await supabase
      .from("action_themes")
      .delete()
      .eq("scope_key", scope_key)
      .eq("action_tag", action_tag);

    const rows = themes.map((t, idx) => ({
      scope_key,
      action_tag,
      theme_name: t.name,
      comment_ids: (t.indices || []).map((i: number) => comments[i]?.id).filter(Boolean),
      example_text: comments[t.indices?.[0]]?.original_text || "",
      sort_order: idx,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("action_themes").insert(rows);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ themes: rows.length, scope_key, action_tag });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "테마 분석 실패";
    console.error("Action themes error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: scope_key로 테마 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope_key = searchParams.get("scope_key");

    if (!scope_key) {
      return NextResponse.json({ error: "scope_key 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("action_themes")
      .select("*")
      .eq("scope_key", scope_key)
      .order("action_tag")
      .order("sort_order");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "테마 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: scope_key의 테마 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { scope_key, action_tag } = (await req.json()) as {
      scope_key: string;
      action_tag?: ActionTag;
    };

    if (!scope_key) {
      return NextResponse.json({ error: "scope_key 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase.from("action_themes").delete().eq("scope_key", scope_key);
    if (action_tag) {
      query = query.eq("action_tag", action_tag);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "테마 삭제 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
