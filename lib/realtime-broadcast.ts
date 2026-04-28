// 변경 이벤트를 모든 클라이언트에 푸시 (Realtime broadcast via REST API)
// payload에는 변경된 필드만 포함 (id 필수) — 클라이언트가 기존 객체에 머지
//
// REST 방식을 쓰는 이유: WebSocket 연결을 매번 만들지 않아 serverless 환경에서 효율적
// 동시 연결 수 제한도 안 잡아먹음
export async function broadcastCommentUpdate(
  payload: { id: string } & Record<string, unknown>,
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: "comments-events",
            event: "comment-updated",
            payload,
          },
        ],
      }),
    });
  } catch (err) {
    // broadcast 실패는 mutation 자체엔 영향 없음 (UI는 옵티미스틱 업데이트 유지)
    console.warn("[realtime-broadcast] 전송 실패:", err);
  }
}
