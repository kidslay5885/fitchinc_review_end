import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { instructorName, freeTexts, hopeTexts } = await req.json();

    if ((!freeTexts || freeTexts.length === 0) && (!hopeTexts || hopeTexts.length === 0)) {
      return NextResponse.json({ complaints: [], suggestions: [], strengths: [] });
    }

    const freeSection =
      freeTexts?.length > 0
        ? `## 후기 설문 자유의견:\n${freeTexts.map((t: any) => `- ${t.name}: "${t.text}"`).join("\n")}`
        : "";

    const hopeSection =
      hopeTexts?.length > 0
        ? `## 사전 설문 바라는점:\n${hopeTexts.map((t: any) => `- ${t.name}: "${t.text}"`).join("\n")}`
        : "";

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `당신은 온라인 강의 플랫폼의 수강생 설문 분석 전문가입니다.
아래는 "${instructorName}" 강사의 수강생 설문 응답입니다. 이 데이터를 분석하여 JSON 형태로 분류해주세요.

${freeSection}

${hopeSection}

다음 JSON 형식으로 응답해주세요 (JSON만 출력, 다른 텍스트 없이):
{
  "complaints": [
    { "theme": "불만 테마명", "count": 언급횟수, "who": ["이름1", "이름2"], "detail": "구체적 내용 요약" }
  ],
  "suggestions": [
    { "from": "이름", "text": "제안 내용 요약" }
  ],
  "strengths": [
    { "title": "긍정 포인트 제목", "responses": [{ "name": "이름", "text": "원문 또는 요약" }] }
  ]
}

규칙:
- 불만사항: 비슷한 주제끼리 그룹핑, 반복 횟수 표시, 단순 인사/감사 제외
- 제안사항: 구체적인 개선 요청만 포함
- 긍정평가: 의미있는 칭찬/만족 포인트만 (짧은 "좋았습니다" 제외)
- ".", "없습니다", "잘 부탁드립니다" 등 무의미한 답변은 모두 무시`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ complaints: [], suggestions: [], strengths: [] });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "분석 실패" },
      { status: 500 }
    );
  }
}
