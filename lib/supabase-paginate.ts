import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";

// Supabase 기본 1000행 제한 우회
// 첫 페이지에서 count: 'exact'로 총 행수를 얻은 뒤, 필요한 페이지만 병렬 요청

// buildQuery: (from, to, withCount) → 같은 필터의 "새" 쿼리 빌더를 반환
//   withCount=true면 select(..., { count: 'exact' })를 사용해야 함
//   (range가 빌더 인스턴스를 점유하므로 매번 새로 만들어야 한다)
export async function fetchAllRanges<T = Record<string, unknown>>(
  buildQuery: (from: number, to: number, withCount: boolean) => PromiseLike<{
    data: unknown;
    count?: number | null;
    error: PostgrestError | null;
  }>,
  pageSize: number = 1000,
): Promise<T[]> {
  const first = await buildQuery(0, pageSize - 1, true);
  if (first.error) throw first.error;
  const firstRows = (first.data as T[]) || [];
  const total = typeof first.count === "number" ? first.count : firstRows.length;
  if (total <= pageSize) return firstRows;

  const pageCount = Math.ceil(total / pageSize);
  // 동시성 5로 제한해 큰 테이블에서 Supabase rate limit 또는 브라우저 네트워크 큐 압박을 방지한다.
  // (이전: Promise.all 무제한 → 50페이지 데이터셋에서 49개 동시 요청 폭주)
  const CONCURRENCY = 5;
  let all: T[] = firstRows;
  for (let pageIdx = 1; pageIdx < pageCount; pageIdx += CONCURRENCY) {
    const end = Math.min(pageIdx + CONCURRENCY, pageCount);
    const batch = await Promise.all(
      Array.from({ length: end - pageIdx }, (_, i) => {
        const idx = pageIdx + i;
        return buildQuery(idx * pageSize, (idx + 1) * pageSize - 1, false);
      }),
    );
    for (const r of batch) {
      if (r.error) throw r.error;
      all = all.concat((r.data as T[]) || []);
    }
  }
  return all;
}

// 편의 함수: in(column, ids) 필터 하나만 걸린 기본 케이스
export async function fetchAllByIn<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: (string | number)[],
  options: { select?: string; orderBy?: string; pageSize?: number } = {},
): Promise<T[]> {
  if (ids.length === 0) return [];
  const { select = "*", orderBy, pageSize = 1000 } = options;
  return fetchAllRanges<T>((from, to, withCount) => {
    let q = supabase
      .from(table)
      .select(select, withCount ? { count: "exact" } : undefined)
      .in(column, ids);
    if (orderBy) q = q.order(orderBy);
    return q.range(from, to);
  }, pageSize);
}
