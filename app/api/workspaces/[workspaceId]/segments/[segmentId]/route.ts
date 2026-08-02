import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  updateSegment, deleteSegment, duplicateSegment, selectionImpact, SegmentError,
} from "@/lib/services/segments.service";

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

type Ctx = { params: Promise<{ workspaceId: string; segmentId: string }> };

/** What deleting this Selection would take with it — asked BEFORE the
 *  confirmation, so the warning can name real numbers instead of a generality. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId, segmentId } = await params;
    const { userId } = await getSession();
    const impact = await selectionImpact(workspaceId, userId, segmentId);
    return NextResponse.json({ impact });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { workspaceId, segmentId } = await params;
    const { userId } = await getSession();
    const b = await req.json().catch(() => ({}));
    const segment = await updateSegment(workspaceId, userId, segmentId, {
      ...(b.surahNumber !== undefined ? { surahNumber: Number(b.surahNumber) } : {}),
      ...(b.startAyah   !== undefined ? { startAyah:   Number(b.startAyah) }   : {}),
      ...(b.endAyah     !== undefined ? { endAyah:     Number(b.endAyah) }     : {}),
      ...(b.name        !== undefined ? { name:        String(b.name) }        : {}),
      ...(b.description !== undefined ? { description: b.description }         : {}),
      ...(b.color       !== undefined ? { color:       b.color }               : {}),
      ...(b.sortOrder   !== undefined ? { sortOrder:   Number(b.sortOrder) }   : {}),
    });
    return NextResponse.json({ segment });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

/** POST duplicates — a body-less action on an existing segment. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { workspaceId, segmentId } = await params;
    const { userId } = await getSession();
    const segment = await duplicateSegment(workspaceId, userId, segmentId);
    return NextResponse.json({ segment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { workspaceId, segmentId } = await params;
    const { userId } = await getSession();
    const res = await deleteSegment(workspaceId, userId, segmentId);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}
