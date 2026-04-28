// 변경 이벤트를 모든 클라이언트에 푸시 (Realtime broadcast via REST API)
// payload에는 변경된 필드만 포함 (id 필수) — 클라이언트가 기존 객체에 머지
//
// REST 방식을 쓰는 이유: WebSocket 연결을 매번 만들지 않아 serverless 환경에서 효율적
// 동시 연결 수 제한도 안 잡아먹음

const TOPIC = "comments-events";

async function postBroadcast(messages: { event: string; payload: unknown }[]): Promise<void> {
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
        messages: messages.map((m) => ({ topic: TOPIC, ...m })),
      }),
    });
  } catch (err) {
    // broadcast 실패는 mutation 자체엔 영향 없음 (UI는 옵티미스틱 업데이트 유지)
    console.warn("[realtime-broadcast] 전송 실패:", err);
  }
}

// 단건 변경 푸시
export async function broadcastCommentUpdate(
  payload: { id: string } & Record<string, unknown>,
): Promise<void> {
  await postBroadcast([{ event: "comment-updated", payload }]);
}

// 일괄 변경 푸시 — 여러 댓글이 한 번에 바뀐 경우 (예: AI 일괄 분류)
// 빈 배열은 무시
export async function broadcastCommentBulkUpdate(
  updates: Array<{ id: string } & Record<string, unknown>>,
): Promise<void> {
  if (updates.length === 0) return;
  await postBroadcast([{ event: "comments-bulk-updated", payload: { updates } }]);
}

// 새 댓글 생성 푸시 — 업로드 등으로 새 댓글이 추가된 경우
// payload: 추가된 댓글 객체 배열 (id 필수, 다른 필드 모두 포함 권장)
export async function broadcastCommentsCreated(
  comments: Array<{ id: string } & Record<string, unknown>>,
): Promise<void> {
  if (comments.length === 0) return;
  await postBroadcast([{ event: "comments-created", payload: { comments } }]);
}

// 댓글 삭제 푸시 — 재업로드 등으로 기존 댓글이 삭제된 경우
export async function broadcastCommentsDeleted(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await postBroadcast([{ event: "comments-deleted", payload: { ids } }]);
}
