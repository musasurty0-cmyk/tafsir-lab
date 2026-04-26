import { NextResponse } from "next/server";
import { fetchVerses } from "@/lib/quran-api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surahId: string }> }
) {
  try {
    const { surahId } = await params;
    const verses = await fetchVerses(Number(surahId));
    return NextResponse.json({ verses });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
