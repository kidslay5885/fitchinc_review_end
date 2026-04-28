"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 브라우저 전용 Supabase 클라이언트 (anon key)
// Realtime broadcast 채널 구독에만 사용 — DB 직접 쿼리는 서버 라우트가 담당
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn("[supabase-client] NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정 — Realtime 비활성화");
    return null;
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
