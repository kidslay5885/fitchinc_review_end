import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "@/lib/supabase";
import { broadcastCommentBulkUpdate } from "@/lib/realtime-broadcast";
import { AI_LABEL_TO_TAG } from "@/lib/action-utils";
import type { ActionTag } from "@/lib/types";

export const maxDuration = 300;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const BASE_DELAY = 4000; // 배치 간 기본 대기 4초

interface ClassifyItem {
  id: string;
  original_text: string;
  source_field: string;
}

async function classifyBatch(
  aiClient: GoogleGenAI,
  items: ClassifyItem[]
): Promise<{ index: number; tag: string }[]> {
  const prompt = `당신은 온라인 강의 플랫폼의 설문 댓글을 분류하는 전문가입니다.

## 분류 기준 (6개)
- **강사**: 강사가 바꾸면 해결되는 것 (수업 방식, 진도, 자료, 설명, 소통, 강사 칭찬 포함)
- **PM**: 기획·운영에서 해결하는 것 (커리큘럼 구조, 시수, 일정, 장소, 수강 프로세스, 공지, 안내)
- **PD**: 영상 편집으로 해결되는 것 (화질, 편집, 화면 비율, 포커스, 영상 길이, 음질)
- **개발**: 시스템 수정이 필요한 것 (접속 오류, 로딩, 홈페이지 버그, 플랫폼 시스템, AI 툴 오류/기능)
- **CS**: 돈·계약 관련 처리 (환불, 결제 오류, 수강권, 가격 불만, 과장 광고 불만)
- **액션없음**: 처리 불필요 (단순 감상, 의미없는 답변, 개인 사정, 구체적 요청 없는 기대감)

## 판단 원칙
1. "누가 액션을 취해야 하는가?" 기준
2. 강사 관련 긍정 피드백(칭찬)도 "강사"
3. 구체적 요청 없이 막연한 기대("잘 부탁드립니다")는 "액션없음"
4. 하나의 댓글에 여러 주제 → 가장 핵심적인 것

## 입력
${items.map((c, i) => `[${i}] (${c.source_field}) ${c.original_text}`).join("\n")}

## JSON 출력
[{"index":0,"tag":"강사"},...]`;

  const response = await aiClient.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const text = response.text || "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items: ClassifyItem[] };
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "items 필요" }, { status: 400 });
    }

    const supabase = getSupabase();
    let classified = 0;
    const results: { id: string; action_tag: ActionTag }[] = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batchUpdates: Array<{ id: string; action_tag: ActionTag }> = [];

      let aiResults: { index: number; tag: string }[] = [];
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          aiResults = await classifyBatch(ai, batch);
          break; // 성공하면 루프 탈출
        } catch (e) {
          console.error(`Batch ${batchNum} attempt ${attempt}/${MAX_RETRIES} error:`, e);
          if (attempt < MAX_RETRIES) {
            // 재시도 대기: 4초, 8초, ... (exponential backoff)
            const retryDelay = BASE_DELAY * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, retryDelay));
          }
        }
      }

      for (const r of aiResults) {
        if (r.index === undefined || !batch[r.index]) continue;
        const item = batch[r.index];
        const actionTag = AI_LABEL_TO_TAG[r.tag];
        if (!actionTag) continue;

        const { error } = await supabase
          .from("comments")
          .update({ action_tag: actionTag })
          .eq("id", item.id);

        if (!error) {
          classified++;
          results.push({ id: item.id, action_tag: actionTag });
          batchUpdates.push({ id: item.id, action_tag: actionTag });
        }
      }

      // 배치 단위로 다른 사용자에게 변경 푸시 (한 번의 broadcast로)
      await broadcastCommentBulkUpdate(batchUpdates);

      // 배치 간 throttle
      if (i + BATCH_SIZE < items.length) {
        await new Promise((r) => setTimeout(r, BASE_DELAY));
      }
    }

    return NextResponse.json({ classified, results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "분류 실패";
    console.error("Action classify error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
