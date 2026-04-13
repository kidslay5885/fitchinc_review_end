import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "@/lib/supabase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// POST: 불만/제안/강점 테마 분류
export async function POST(req: NextRequest) {
  try {
    const { instructorName, freeTexts, hopeTexts, surveyQuestions, platform, instructor, cohort } =
      await req.json();

    if (!freeTexts?.length && !hopeTexts?.length) {
      return NextResponse.json(
        { complaints: [], suggestions: [], strengths: [] }
      );
    }

    // 동적 설문 질문 통계 섹션 구성
    let surveySection = "";
    if (surveyQuestions && surveyQuestions.length > 0) {
      const lines = surveyQuestions.map((sq: { question: string; summary: Record<string, number>; total: number }) => {
        const dist = Object.entries(sq.summary)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .map(([answer, count]) => `${answer} ${Math.round(((count as number) / sq.total) * 100)}%`)
          .join(", ");
        return `- ${sq.question}: ${dist} (총 ${sq.total}명)`;
      });
      surveySection = `\n\n== 사전 설문 통계 ==\n${lines.join("\n")}`;
    }

    const prompt = `당신은 온라인 강의 설문 데이터 분석 전문가입니다.

강사: ${instructorName}

== 후기 자유 응답 ==
${(freeTexts || []).map((t: { name: string; text: string }, i: number) => `[${i}] ${t.name}: "${t.text}"`).join("\n") || "(없음)"}

== 사전 설문 바라는 점 ==
${(hopeTexts || []).map((t: { name: string; text: string }, i: number) => `[${i}] ${t.name}: "${t.text}"`).join("\n") || "(없음)"}${surveySection}

다음 JSON만 출력하세요:
{
  "complaints": [
    { "theme": "주제", "count": 응답수, "who": ["이름1","이름2"], "detail": "요약" }
  ],
  "suggestions": [
    { "from": "이름", "text": "제안 내용" }
  ],
  "strengths": [
    { "title": "강점 주제", "responses": [{"name":"이름","text":"원문"}] }
  ]
}

분류 기준:
- complaints: 2회 이상 반복된 불만/아쉬운 점을 테마별로 묶기
- suggestions: 구체적 개선 제안 (1건도 포함)
- strengths: 긍정 피드백을 주제별로 묶기
- 1~2줄 단답은 무시
- 사전 설문 통계가 있으면 수강생 배경/특성을 참고하여 인사이트를 더 구체적으로 제시
- JSON만 출력, 다른 텍스트 없이`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json(
        { complaints: [], suggestions: [], strengths: [] }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    // 캐시 저장
    if (platform && instructor) {
      try {
        const supabase = getSupabase();
        await supabase.from("analysis_cache").upsert(
          {
            platform,
            instructor,
            cohort: cohort || null,
            result,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "platform,instructor,cohort" }
        );
      } catch {
        // 캐시 저장 실패는 무시
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "분석 실패";
    console.error("Analyze themes error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: 캐시된 분석 결과 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const platform = searchParams.get("platform");
    const instructor = searchParams.get("instructor");
    const cohort = searchParams.get("cohort");

    if (!platform || !instructor) {
      return NextResponse.json({ error: "platform, instructor 필수" }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase
      .from("analysis_cache")
      .select("result")
      .eq("platform", platform)
      .eq("instructor", instructor);

    if (cohort) {
      query = query.eq("cohort", cohort);
    } else {
      query = query.is("cohort", null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json(data.result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "캐시 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
