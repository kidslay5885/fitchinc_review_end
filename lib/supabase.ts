import { createClient } from "@supabase/supabase-js";

// 서버 전용 Supabase 클라이언트 (service_role key)
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_KEY가 설정되지 않았습니다");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
