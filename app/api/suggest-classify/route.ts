import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Vercel 서버리스 함수 타임아웃 확장 (기본 10초 → 60초)
export const maxDuration = 60;

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

const TAG_VALUES = ["platform_pm", "platform_pd", "platform_cs", "platform_general", "platform_etc", "instructor"] as const;
const SENTIMENT_VALUES = ["positive", "negative", "neutral"] as const;

// POST: 미분류 피드백에 대해 AI가 전달 대상(tag) + 긍정/부정(sentiment) 제안
export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json() as { items: { id: string; original_text: string; source_field?: string }[] };
    if (!items?.length || items.length > 50) {
      return NextResponse.json(
        { error: "items 배열 필요 (최대 50건)" },
        { status: 400 }
      );
    }

    const prompt = `당신은 온라인 강의 설문 피드백를 검수하는 팀을 돕는 AI입니다.
아래 각 피드백에 대해 (1) 전달 대상, (2) 긍정/부정/중립을 판단해 JSON으로만 답하세요.

전달 대상(tag) 규칙:
- platform_pm: 플랫폼 운영·기획 관련 (일정, 안내, 시스템)
- platform_pd: 콘텐츠·커리큘럼·교재 관련
- platform_cs: 고객 지원·문의 대응 관련
- platform_general: 플랫폼 전반에 대한 피드백 (서비스, 브랜드, 플랫폼 자체에 대한 요청/의견)
- platform_etc: 플랫폼 관련이지만 PM/PD/CS/플랫폼으로 구분 어려움
- instructor: 강사 수업·강의 방식·강사本人 관련

감성(sentiment): positive(긍정/칭찬), negative(불만/비판), neutral(중립/단순 의견)

피드백 목록:
${items.map((item: { id: string; original_text: string }, i: number) => `[${i}] id:${item.id}\n"${(item.original_text || "").slice(0, 300)}"`).join("\n\n")}

다음 JSON만 출력 (다른 텍스트 없이):
{
  "suggestions": [
    { "commentId": "위 id와 동일", "tag": "platform_pm|platform_pd|platform_cs|platform_general|platform_etc|instructor", "sentiment": "positive|negative|neutral" }
  ]
}
각 항목마다 반드시 한 개씩, commentId는 입력의 id와 정확히 일치해야 합니다.`;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ suggestions: [] });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { suggestions?: { commentId: string; tag: string; sentiment: string }[] };
    const suggestions = (parsed.suggestions || []).map((s) => {
      const tag = TAG_VALUES.includes(s.tag as any) ? s.tag : "platform_etc";
      const sentiment = SENTIMENT_VALUES.includes(s.sentiment as any) ? s.sentiment : "neutral";
      return { commentId: s.commentId, tag, sentiment };
    });
    return NextResponse.json({ suggestions });
  } catch (e: unknown) {
    console.error("suggest-classify", e);
    return NextResponse.json(
      { error: (e instanceof Error ? e.message : "AI 제안 실패") },
      { status: 500 }
    );
  }
}
