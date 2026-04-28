"use client";

import type { CommentWithAction } from "@/lib/types";

// 직무별 피드백 모드의 분류 댓글 공유 캐시
// status별로 캐시 분리해서 첫 진입 시 미처리만 받도록 페이로드 축소
// TTL 30초 + in-flight dedup + Realtime broadcast 머지 지원

const TTL_MS = 30_000;
const TAGS = ["platform_pm", "platform_pd", "platform_cs", "platform_general", "platform_etc", "instructor"];

export type CommentsStatusFilter = "unprocessed" | "processed" | "all";

type CacheEntry = { data: CommentWithAction[]; at: number };

const caches: Record<CommentsStatusFilter, CacheEntry | null> = {
  unprocessed: null,
  processed: null,
  all: null,
};
const inFlights: Record<CommentsStatusFilter, Promise<CommentWithAction[]> | null> = {
  unprocessed: null,
  processed: null,
  all: null,
};

function buildUrl(status: CommentsStatusFilter): string {
  const base = `/api/classify?tags=${TAGS.join(",")}`;
  return status === "all" ? base : `${base}&status=${status}`;
}

// fetch + 캐시 저장 (force=true면 캐시 무시하고 새로 받음)
export async function getClassifiedComments(
  status: CommentsStatusFilter = "all",
  force: boolean = false,
): Promise<CommentWithAction[]> {
  const now = Date.now();
  const cache = caches[status];
  if (!force && cache && now - cache.at < TTL_MS) return cache.data;
  if (!force && inFlights[status]) return inFlights[status]!;

  const promise = (async () => {
    try {
      const res = await fetch(buildUrl(status));
      const data: CommentWithAction[] = res.ok ? await res.json() : [];
      caches[status] = { data, at: Date.now() };
      return data;
    } finally {
      inFlights[status] = null;
    }
  })();
  inFlights[status] = promise;
  return promise;
}

// 모든 캐시에 동일 변경 적용 (어느 캐시에 있든 in-place 갱신)
function forEachCache(fn: (entry: CacheEntry) => void): void {
  for (const status of ["unprocessed", "processed", "all"] as const) {
    const entry = caches[status];
    if (entry) fn(entry);
  }
}

// Realtime broadcast로 받은 단건 변경을 캐시에 반영
export function applyCommentUpdate(patch: { id: string } & Partial<CommentWithAction>): void {
  forEachCache((entry) => {
    entry.data = entry.data.map((c) =>
      c.id === patch.id ? ({ ...c, ...patch } as CommentWithAction) : c,
    );
  });
}

// 일괄 변경 반영
export function applyCommentBulkUpdate(updates: Array<{ id: string } & Partial<CommentWithAction>>): void {
  if (updates.length === 0) return;
  const updateMap = new Map(updates.map((u) => [u.id, u]));
  forEachCache((entry) => {
    entry.data = entry.data.map((c) => {
      const u = updateMap.get(c.id);
      return u ? ({ ...c, ...u } as CommentWithAction) : c;
    });
  });
}

// 새 댓글 추가 (upload 등) — 새 댓글은 process_status가 없으므로 unprocessed/all 캐시에 추가
export function applyCommentsCreated(newComments: CommentWithAction[]): void {
  if (newComments.length === 0) return;
  for (const status of ["unprocessed", "all"] as const) {
    const entry = caches[status];
    if (!entry) continue;
    const existing = new Set(entry.data.map((c) => c.id));
    const fresh = newComments.filter((c) => !existing.has(c.id));
    if (fresh.length > 0) entry.data = [...entry.data, ...fresh];
  }
}

// 댓글 삭제 (재업로드 등)
export function applyCommentsDeleted(ids: string[]): void {
  if (ids.length === 0) return;
  const removeSet = new Set(ids);
  forEachCache((entry) => {
    entry.data = entry.data.filter((c) => !removeSet.has(c.id));
  });
}

// 강제 무효화 — 다음 getClassifiedComments 호출 시 새로 fetch
export function invalidateCommentsCache(): void {
  caches.unprocessed = null;
  caches.processed = null;
  caches.all = null;
}
