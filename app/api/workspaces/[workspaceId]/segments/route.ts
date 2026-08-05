import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listSegments, createSegment } from "@/lib/services/segments.service";
import { apiError } from "@/lib/api-errors";

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
    return apiError(e);
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
    return apiError(e);
  }
}
