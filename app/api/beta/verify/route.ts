import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };

  const correct = process.env.BETA_ACCESS_PASSWORD;
  if (!correct) {
    return NextResponse.json(
      { ok: false, error: "Beta access not configured" },
      { status: 500 },
    );
  }

  if (!password || password !== correct) {
    return NextResponse.json(
      { ok: false, error: "Invalid access code" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("beta_access", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
