import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "@/lib/supabase";

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

export async function POST(req: NextRequest) {
  try {
    const { surveyId } = await req.json();
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId 필요" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: comments, error: fetchError } = await supabase
      .from("comments")
      .select("*")
      .eq("survey_id", surveyId)
      .order("created_at");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!comments || comments.length === 0) {
      return NextResponse.json({ analyzed: 0 });
    }

    const commentList = comments.map((c, i) => ({
      index: i,
      respondent: c.respondent,
      text: c.original_text,
      field: c.source_field,
    }));

    const BATCH_SIZE = 50;
    let totalAnalyzed = 0;

    for (let offset = 0; offset < commentList.length; offset += BATCH_SIZE) {
      const batch = commentList.slice(offset, offset + BATCH_SIZE);

      const prompt = `당신은 온라인 강의 수강생 설문 분석 전문가입니다.
아래 댓글들을 각각 긍정/부정/중립으로 분류하고, 핵심 내용을 한줄로 요약해주세요.

댓글 목록:
${batch.map((c) => `[${c.index}] ${c.respondent} (${c.field}): "${c.text}"`).join("\n")}

다음 JSON 배열만 출력하세요 (다른 텍스트 없이):
[
  { "index": 0, "sentiment": "positive", "summary": "한줄 요약" },
  ...
]

분류 기준:
- positive: 만족, 감사, 추천, 좋았다, 도움이 됐다 등
- negative: 불만, 아쉬움, 부족, 개선 요청 등
- neutral: 단순 사실 전달, 무의미, 짧은 응답 등
- ".", "없습니다", "없음" 등 무의미한 답변은 neutral`;

      const response = await getAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      try {
        const results: { index: number; sentiment: string; summary: string }[] =
          JSON.parse(jsonMatch[0]);

        for (const r of results) {
          const globalIndex = offset + r.index;
          if (globalIndex >= comments.length) continue;

          const comment = comments[globalIndex];
          await supabase
            .from("comments")
            .update({
              sentiment: r.sentiment,
              ai_summary: r.summary,
            })
            .eq("id", comment.id);

          totalAnalyzed++;
        }
      } catch {
        console.error("JSON parse error for batch at offset", offset);
      }
    }

    await supabase
      .from("surveys")
      .update({ status: "analyzed" })
      .eq("id", surveyId);

    return NextResponse.json({ analyzed: totalAnalyzed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "분석 실패";
    console.error("Analysis error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
