/**
 * GET /api/youth-majlis/pack/<id>             → 302 to the PDF, to read in the browser
 * GET /api/youth-majlis/pack/<id>?download=1  → 302 to the PDF, saved as a file
 *
 * A prep pack, for the cohort only: through the portal's gate, signed in to
 * TafsirLab, and not removed from the cohort. The file itself is handed out
 * by the realtime worker with a two-minute link (lib/youth-majlis/packs).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { packLink } from "@/lib/youth-majlis/packs";

const text = (body: string, status: number) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAccess("majlis"))) return NextResponse.redirect(new URL("/youth-majlis", req.url));
  const session = await getSessionOrNull();
  if (!session) return NextResponse.redirect(new URL("/login?next=/youth-majlis", req.url));
  const member = await db.youthMajlisProgress.findUnique({ where: { userId: session.userId }, select: { role: true } });
  if (!member || member.role === "left") return text("This prep pack is for the Youth Majlis cohort.", 403);

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return text("No such prep pack.", 404);
  const url = await packLink(id, req.nextUrl.searchParams.get("download") === "1");
  if (url === undefined) return text("No such prep pack.", 404);
  if (url === null) {
    return text("This month’s download allowance is used up, to keep the file store inside Cloudflare’s free plan. It resets on the 1st.", 429);
  }
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
