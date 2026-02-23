import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.AUTH_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json(
        { error: "AUTH_PASSWORD가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    if (password !== correctPassword) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("ci_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일
    });

    return res;
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("ci_auth");
  return res;
}
