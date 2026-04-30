import type { SupabaseClient } from "@supabase/supabase-js";

// 강사 사진을 base64로 받지 않고 Supabase Storage에 저장하기 위한 헬퍼.
// app_settings 테이블에는 photo 필드에 public URL만 들어간다.

const BUCKET = "instructor-photos";

// data:image/png;base64,XXXX 형태인지 검사
export function isBase64DataUri(s: unknown): s is string {
  return typeof s === "string" && /^data:image\/[\w+.-]+;base64,/.test(s);
}

// 같은 강사의 사진은 항상 같은 키에 덮어쓰므로 orphan 파일이 쌓이지 않는다.
// 한글 키는 Supabase Storage가 그대로 받아주며 URL은 SDK가 인코딩한다.
function objectKey(platform: string, instructor: string): string {
  return `${platform}/${instructor}.png`;
}

interface ParsedDataUri {
  mime: string;
  buffer: Buffer;
}

function parseDataUri(dataUri: string): ParsedDataUri | null {
  const m = dataUri.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!m) return null;
  try {
    return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

// base64 data URI를 Storage에 업로드하고 public URL을 반환.
// 같은 키에 덮어쓰므로 (platform, instructor)당 1개 파일만 유지된다.
export async function uploadInstructorPhoto(
  supabase: SupabaseClient,
  platform: string,
  instructor: string,
  dataUri: string,
): Promise<string> {
  const parsed = parseDataUri(dataUri);
  if (!parsed) throw new Error("invalid base64 data URI");

  const key = objectKey(platform, instructor);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, parsed.buffer, {
      contentType: parsed.mime,
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  // 같은 URL이라도 사진이 바뀌면 브라우저 캐시를 우회하기 위해 버전 쿼리 부여
  return `${data.publicUrl}?v=${Date.now()}`;
}

// photo="" 가 들어왔을 때 Storage 파일도 정리.
// 실패해도 무시 (이미 없을 수 있음).
export async function deleteInstructorPhoto(
  supabase: SupabaseClient,
  platform: string,
  instructor: string,
): Promise<void> {
  const key = objectKey(platform, instructor);
  await supabase.storage.from(BUCKET).remove([key]).catch(() => {});
}
