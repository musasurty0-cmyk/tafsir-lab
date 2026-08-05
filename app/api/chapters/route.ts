import { NextResponse } from "next/server";
import { fetchChapters } from "@/lib/quran-api";
import { apiError } from "@/lib/api-errors";

export async function GET() {
  try {
    const chapters = await fetchChapters();
    return NextResponse.json({ chapters });
  } catch (e) {
    return apiError(e);
  }
}
