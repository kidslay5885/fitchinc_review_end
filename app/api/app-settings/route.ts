import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const TABLE = "app_settings";

function photoKey(platform: string, instructor: string) {
  return `instructor_photo:${platform}:${instructor}`;
}

function cohortOrderKey(platform: string, instructor: string, course: string = "") {
  return `cohort_order:${platform}:${instructor}${course ? `:${course}` : ""}`;
}

const BLOCKLIST_KEY = "prevCourse_blocklist";

/** GET: 모든 앱 설정 조회 (강사 사진, 기수 순서, 수강이력 블랙리스트) - 새 창/새로고침 시 복원용 */
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from(TABLE).select("key, value");

    if (error) {
      console.error("app_settings GET error (table may not exist):", error.message, error.code);
      return NextResponse.json({ instructorPhotos: {}, cohortOrders: {}, prevCourseBlocklist: [] });
    }

    const instructorPhotos: Record<string, { photo: string; photoPosition: string; category?: string }> = {};
    const cohortOrders: Record<string, string[]> = {};
    let prevCourseBlocklist: string[] = [];

    for (const row of data || []) {
      const key = row.key as string;
      const value = row.value as unknown;
      if (key.startsWith("instructor_photo:") && value && typeof value === "object") {
        const v = value as { photo?: string; photoPosition?: string; category?: string };
        instructorPhotos[key] = {
          photo: typeof v.photo === "string" ? v.photo : "",
          photoPosition: typeof v.photoPosition === "string" ? v.photoPosition : "center 2%",
          category: typeof v.category === "string" ? v.category : "",
        };
      } else if (key.startsWith("cohort_order:") && Array.isArray(value)) {
        cohortOrders[key] = value.filter((x) => typeof x === "string");
      } else if (key === BLOCKLIST_KEY && Array.isArray(value)) {
        prevCourseBlocklist = value.filter((x) => typeof x === "string");
      }
    }

    return NextResponse.json(
      { instructorPhotos, cohortOrders, prevCourseBlocklist },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    console.warn("app_settings GET error:", e);
    return NextResponse.json(
      { instructorPhotos: {}, cohortOrders: {}, prevCourseBlocklist: [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

/** POST: 강사 사진 또는 기수 순서 저장 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.type === "instructor_photo") {
      const { platform, instructor, photo, photoPosition, category } = body;
      if (!platform || !instructor) {
        return NextResponse.json({ ok: false, error: "platform, instructor 필요" }, { status: 400 });
      }
      const key = photoKey(platform, instructor);
      const photoStr = typeof photo === "string" ? photo : "";
      const value: Record<string, string> = { photo: photoStr, photoPosition: photoPosition || "center 2%" };
      if (typeof category === "string") value.category = category;

      const supabase = getSupabase();
      const { error } = await supabase.from(TABLE).upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) {
        console.error("app_settings upsert photo error:", error.message, "key:", key, "photoLen:", photoStr.length);
        return NextResponse.json({ ok: false, error: error.message });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.type === "cohort_order") {
      const { platform, instructor, course, labels } = body;
      if (!platform || !instructor || !Array.isArray(labels)) {
        return NextResponse.json({ error: "platform, instructor, labels 필요" }, { status: 400 });
      }
      const key = cohortOrderKey(platform, instructor, course || "");
      const value = labels.filter((x: unknown) => typeof x === "string");

      const supabase = getSupabase();
      const { error } = await supabase.from(TABLE).upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("app_settings upsert cohort_order error:", error.message);
        return NextResponse.json({ ok: false });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.type === "prevCourse_blocklist") {
      const { action, text } = body;
      if (!action || typeof text !== "string") {
        return NextResponse.json({ error: "action(add|remove), text 필요" }, { status: 400 });
      }

      const supabase = getSupabase();

      // 기존 블랙리스트 조회
      const { data: existing } = await supabase
        .from(TABLE)
        .select("value")
        .eq("key", BLOCKLIST_KEY)
        .single();
      let list: string[] = Array.isArray(existing?.value) ? (existing.value as string[]) : [];

      if (action === "add") {
        if (!list.includes(text)) list.push(text);
      } else if (action === "remove") {
        list = list.filter((item) => item !== text);
      } else {
        return NextResponse.json({ error: "action: add | remove" }, { status: 400 });
      }

      const { error } = await supabase.from(TABLE).upsert(
        { key: BLOCKLIST_KEY, value: list, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("app_settings upsert prevCourse_blocklist error:", error.message);
        return NextResponse.json({ ok: false, error: error.message });
      }
      return NextResponse.json({ ok: true, list });
    }

    return NextResponse.json({ error: "type: instructor_photo | cohort_order | prevCourse_blocklist 필요" }, { status: 400 });
  } catch (e) {
    console.warn("app_settings POST error:", e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
