import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { instructorName, cohortLabel, pmName, tone, scores, analysis, demographics } =
      await req.json();

    const toneGuide =
      tone === "suggest"
        ? "제안형 톤: '~해보시는 건 어떨까요?', '~하시면 어떨까요?' 같이 부드럽게 제안하는 톤"
        : "의견형 톤: '~어떻게 생각하세요?', '~어떻게 보시나요?' 같이 상대의 의견을 구하는 톤";

    const analysisSection = analysis
      ? `
## AI 분석 결과:
불만사항: ${JSON.stringify(analysis.complaints || [])}
제안사항: ${JSON.stringify(analysis.suggestions || [])}
긍정평가: ${JSON.stringify(analysis.strengths || [])}`
      : "";

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `당신은 온라인 강의 플랫폼 PM입니다. 강사에게 보낼 피드백 메시지를 작성해주세요.

## 기본 정보:
- 강사명: ${instructorName}
- 기수: ${cohortLabel}
- PM 이름: ${pmName || "OOO"}
- 톤: ${toneGuide}

## 설문 결과:
- 커리큘럼 점수: ${scores?.ps1Avg || 0}/10
- 피드백 점수: ${scores?.ps2Avg || 0}/10
- 추천률: ${scores?.recRate || 0}%
- 사전 설문 응답: ${scores?.preCount || 0}명
- 후기 설문 응답: ${scores?.postCount || 0}명
${demographics?.topGoal ? `- 수강생 목표: ${demographics.topGoal[0]} ${Math.round((demographics.topGoal[1] / (scores?.preCount || 1)) * 100)}%` : ""}
${demographics?.computerAvg ? `- PC 활용도 평균: ${demographics.computerAvg}/10` : ""}
${analysisSection}

## 작성 규칙:
1. 인사 → 전체 만족도 공유 → 긍정 피드백 → 개선점 1~2개 (${toneGuide}) → 운영 관련 처리 안내 → 마무리
2. 강사에게 부담 주지 않되 구체적 액션을 제안
3. 운영 관련(영상 공유, 오픈방 초대 등)은 플랫폼에서 처리한다고 안내
4. 이모지 적절히 사용
5. 서명: "— 핏크닉 PM ${pmName || "OOO"} 드림"
6. 자연스러운 한국어, 존댓말 사용

메시지만 출력해주세요 (JSON 아님):`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ feedback: text.trim() });
  } catch (error: any) {
    console.error("Feedback error:", error);
    return NextResponse.json(
      { error: error.message || "생성 실패" },
      { status: 500 }
    );
  }
}
