import { NextResponse } from "next/server";
import { fetchChapters } from "@/lib/quran-api";

export async function GET() {
  try {
    const chapters = await fetchChapters();
    return NextResponse.json({ chapters });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
