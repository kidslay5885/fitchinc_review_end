import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchAllRanges } from "@/lib/supabase-paginate";
import { isBase64DataUri, uploadInstructorPhoto } from "@/lib/instructor-photo-storage";

// 일회성 마이그레이션 라우트.
// app_settings 의 instructor_photo:* 행 중 photo가 base64인 것을 모두 Storage로 옮기고
// JSONB의 photo 필드를 public URL로 교체한다.
// 운영자가 한 번만 호출하면 끝나는 작업이며, UI 진입점은 없다.
//
// 호출:  POST /api/migrate-photos

export const maxDuration = 120;

interface PhotoRow {
  key: string;
  value: { photo?: string; photoPosition?: string; category?: string } | null;
}

export async function POST() {
  try {
    const supabase = getSupabase();

    const rows = await fetchAllRanges<PhotoRow>((from, to, withCount) => {
      return supabase
        .from("app_settings")
        .select("key, value", withCount ? { count: "exact" } : undefined)
        .like("key", "instructor_photo:%")
        .range(from, to);
    });

    let total = 0;
    let migrated = 0;
    let skippedAlreadyUrl = 0;
    let skippedEmpty = 0;
    let failed = 0;
    const errors: { key: string; reason: string }[] = [];

    for (const row of rows) {
      total++;
      const photo = row.value?.photo ?? "";
      if (photo === "") {
        skippedEmpty++;
        continue;
      }
      if (!isBase64DataUri(photo)) {
        // 이미 URL 형태로 저장된 행
        skippedAlreadyUrl++;
        continue;
      }

      // key = "instructor_photo:{platform}:{instructor}"
      const rest = row.key.slice("instructor_photo:".length);
      const colonIdx = rest.indexOf(":");
      if (colonIdx < 0) {
        failed++;
        errors.push({ key: row.key, reason: "키 형식이 instructor_photo:{platform}:{instructor}가 아님" });
        continue;
      }
      const platform = rest.slice(0, colonIdx);
      const instructor = rest.slice(colonIdx + 1);
      if (!platform || !instructor) {
        failed++;
        errors.push({ key: row.key, reason: "platform 또는 instructor 비어있음" });
        continue;
      }

      try {
        const url = await uploadInstructorPhoto(supabase, platform, instructor, photo);
        const newValue = {
          photo: url,
          photoPosition: row.value?.photoPosition || "center 2%",
          ...(typeof row.value?.category === "string" ? { category: row.value.category } : {}),
        };
        const { error: upsertErr } = await supabase
          .from("app_settings")
          .upsert(
            { key: row.key, value: newValue, updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
        if (upsertErr) {
          failed++;
          errors.push({ key: row.key, reason: `upsert 실패: ${upsertErr.message}` });
          continue;
        }
        migrated++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ key: row.key, reason: `업로드 실패: ${msg}` });
      }
    }

    return NextResponse.json({
      ok: true,
      total,
      migrated,
      skippedAlreadyUrl,
      skippedEmpty,
      failed,
      errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("migrate-photos error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
