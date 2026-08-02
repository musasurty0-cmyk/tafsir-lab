import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listSegments, createSegment, SegmentError } from "@/lib/services/segments.service";

/** Map a service error to a status; anything else is a genuine 500. */
function errStatus(e: unknown): number {
  if (e instanceof SegmentError) {
    return e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400;
  }
  const s = String(e);
  // getSession throws plain Errors when there is no valid cookie. Without
  // this the caller sees a 500 and cannot tell "log back in" from "the
  // server is broken".
  if (/Not authenticated|Invalid or expired session|Malformed session/.test(s)) return 401;
  if (s.includes("FORBIDDEN") || s.includes("not a member")) return 403;
  if (s.includes("NOT_FOUND") || s.includes("not found"))    return 404;
  return 500;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const surah = new URL(req.url).searchParams.get("surah");
    const segments = await listSegments(
      workspaceId, userId, surah ? Number(surah) : undefined,
    );
    return NextResponse.json({ segments });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const b = await req.json().catch(() => ({}));
    const segment = await createSegment(workspaceId, userId, {
      surahNumber: Number(b.surahNumber),
      startAyah:   Number(b.startAyah),
      endAyah:     Number(b.endAyah),
      name:        String(b.name ?? ""),
      description: b.description ?? null,
      color:       b.color ?? null,
    });
    return NextResponse.json({ segment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}
