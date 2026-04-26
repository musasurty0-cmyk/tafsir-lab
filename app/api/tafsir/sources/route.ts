/**
 * GET /api/tafsir/sources
 *
 * Returns the catalog of active TafsirSource records.
 * Used by the source picker UI and CLI --list-sources.
 *
 * Response:
 * {
 *   sources: [{ slug, name, nameArabic, language, type }, ...]
 * }
 */

import { NextResponse } from "next/server";
import { listSources } from "@/lib/services/tafsir.service";

export async function GET() {
  try {
    const sources = await listSources();
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("[tafsir/sources route] Error:", err);
    return NextResponse.json({ error: "Failed to load sources" }, { status: 500 });
  }
}
