import { NextResponse } from "next/server";
import { fetchVerses } from "@/lib/quran-api";
import { apiError } from "@/lib/api-errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surahId: string }> }
) {
  try {
    const { surahId } = await params;
    const verses = await fetchVerses(Number(surahId));
    return NextResponse.json({ verses });
  } catch (e) {
    return apiError(e);
  }
}
