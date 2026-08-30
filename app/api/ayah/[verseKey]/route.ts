/**
 * GET /api/ayah/[verseKey]
 *
 * Fetches a single verse from quran.com and returns Arabic text +
 * Saheeh International translation. Used by the AyahBlock NodeView
 * when a verse is embedded in the free editor (Mode A).
 *
 * verseKey format in the URL: "2_255" (colon replaced by underscore).
 * Returns: { verse: { verse_key, text_uthmani, translations: [{ text }], words: [...] } }
 *
 * Words carry code_v2 and v2_page as well as text, so an ayah block can render
 * in the mushaf faces — those glyph codes are meaningless without the page
 * number that selects the font to draw them with.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";

const BASE = "https://api.quran.com/api/v4";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ verseKey: string }> }
) {
  try {
    const { verseKey } = await params;
    // Convert "2_255" → "2:255" for the upstream API
    const apiKey = verseKey.replace("_", ":");

    const url =
      `${BASE}/verses/by_key/${apiKey}` +
      `?language=en&words=true&translations=20` +
      `&fields=text_uthmani` +
      `&word_fields=text_uthmani,transliteration,code_v2,v2_page`;

    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Verse ${apiKey} not found (upstream ${res.status})` },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ verse: data.verse });
  } catch (err) {
    return apiError(err);
  }
}
