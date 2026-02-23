import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET: PM 노트 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const platform = searchParams.get("platform");
    const instructor = searchParams.get("instructor");
    const cohort = searchParams.get("cohort") || "__all__";

    if (!platform || !instructor) {
      return NextResponse.json({ error: "platform, instructor 필수" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("pm_notes")
      .select("*")
      .eq("platform", platform)
      .eq("instructor", instructor)
      .eq("cohort", cohort)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ good: "", bad: "", action: "", memo: "" });
    }

    return NextResponse.json({
      good: data.good || "",
      bad: data.bad || "",
      action: data.action_plan || "",
      memo: data.memo || "",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "노트 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: PM 노트 저장 (upsert)
export async function POST(req: NextRequest) {
  try {
    const { platform, instructor, cohort, good, bad, action, memo } = await req.json();

    if (!platform || !instructor) {
      return NextResponse.json({ error: "platform, instructor 필수" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("pm_notes")
      .upsert(
        {
          platform,
          instructor,
          cohort: cohort || "__all__",
          good: good || "",
          bad: bad || "",
          action_plan: action || "",
          memo: memo || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "platform,instructor,cohort" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "노트 저장 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
