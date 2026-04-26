/**
 * GET /api/tafsir/[verseKey]
 *
 * Returns tafsir for a verse from our database (pre-ingested).
 * Falls back to on-demand fetch if the entry hasn't been ingested yet.
 *
 * URL format:  /api/tafsir/1_1          (verseKey "1:1")
 * Query params:
 *   ?sources=ibn-kathir-en,ibn-kathir-ar   (comma-separated slugs, optional)
 *   ?sources=all                           (return every active source)
 *
 * Response:
 * {
 *   verseKey: "1:1",
 *   entries: [
 *     {
 *       source: { slug, name, nameArabic, language, type },
 *       content: "...",         ← plain text
 *       contentHtml: "...",     ← raw HTML (optional, may be absent)
 *       fetchedAt: "ISO string",
 *       fromCache: true
 *     },
 *     ...
 *   ]
 * }
 */

import { type NextRequest, NextResponse } from "next/server";
import { getTafsirForVerse } from "@/lib/services/tafsir.service";

// verseKey arrives as "1_1" (URL-safe underscore); convert to "1:1"
function decodeKey(raw: string): string {
  return decodeURIComponent(raw).replace("_", ":");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ verseKey: string }> }
) {
  const { verseKey: raw } = await params;
  const verseKey = decodeKey(raw);

  // Validate format: must be "surah:ayah"
  if (!/^\d{1,3}:\d{1,3}$/.test(verseKey)) {
    return NextResponse.json(
      { error: `Invalid verse key format: "${verseKey}". Expected "surah:ayah" (e.g. "1:1").` },
      { status: 400 }
    );
  }

  const sourcesParam = req.nextUrl.searchParams.get("sources") ?? "";
  const slugs: string[] =
    sourcesParam === "all"
      ? []
      : sourcesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  try {
    const result = await getTafsirForVerse(verseKey, slugs);

    return NextResponse.json(result, {
      headers: {
        // Allow CDN to cache clean responses; don't cache errors
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[tafsir route] Error:", err);
    return NextResponse.json(
      { error: "Failed to load tafsir", verseKey },
      { status: 500 }
    );
  }
}
