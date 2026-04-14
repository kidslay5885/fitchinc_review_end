"use client";

// /api/app-settings GET 공유 캐시
// 여러 컴포넌트가 동시에 호출해도 서버 요청은 1회로 dedup, 짧은 TTL로 반복 호출 흡수
// POST로 값이 바뀌면 invalidateAppSettings()를 호출해 다음 GET에서 다시 받도록 한다

type AppSettings = {
  instructorPhotos?: Record<string, { photo?: string; photoPosition?: string; category?: string }>;
  cohortOrders?: Record<string, string[]>;
  prevCourseBlocklist?: string[];
  excludedSourceFields?: string[];
  hiddenComments?: string[];
  starredComments?: string[];
  transferOrigins?: Record<string, string>;
};

const TTL_MS = 5_000; // 5초 동안 재사용

let cached: { at: number; data: AppSettings } | null = null;
let inFlight: Promise<AppSettings> | null = null;

export async function getAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/app-settings", { cache: "no-store" });
      if (!res.ok) return {};
      const data = (await res.json()) as AppSettings;
      cached = { at: Date.now(), data };
      return data;
    } catch {
      return cached?.data || {};
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function invalidateAppSettings() {
  cached = null;
}
