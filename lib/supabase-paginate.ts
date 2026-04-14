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
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      buildQuery((i + 1) * pageSize, (i + 2) * pageSize - 1, false),
    ),
  );
  let all: T[] = firstRows;
  for (const r of rest) {
    if (r.error) throw r.error;
    all = all.concat((r.data as T[]) || []);
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
