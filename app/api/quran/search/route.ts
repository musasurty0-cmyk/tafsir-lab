import { NextResponse } from "next/server";
import { fetchQpcSurah } from "@/lib/quran-api";
import { plainTranslation } from "@/lib/quran-text";

/**
 * Verse TEXT search.
 *
 * References and Surah names are resolved on the client (see lib/quran-search)
 * because 114 chapters fit in memory and must feel instant. Only full-text
 * search reaches here, where it is proxied to the Qurʾān API.
 *
 * Proxied rather than called from the browser so the upstream response can be
 * cached on our side and shared between users: the same handful of phrases get
 * searched repeatedly, and a cache hit costs nothing. It also keeps the
 * response shape ours, so swapping the upstream later does not touch the UI.
 */

const BASE = "https://api.quran.com/api/v4";

export interface VerseHit {
  verseKey: string;
  surah:    number;
  ayah:     number;
  arabic:   string;
  translation?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  // Below two characters every query matches almost everything, which is a
  // slow request for a useless result.
  if (q.length < 2) return NextResponse.json({ results: [] });

  const size = Math.min(Number(searchParams.get("size") ?? 20) || 20, 40);

  try {
    const params = new URLSearchParams({
      q,
      size: String(size),
      page: "1",
      language: "en",
    });
    const res = await fetch(`${BASE}/search?${params}`, {
      // Shared cache; search results for a given phrase are stable.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ results: [], error: `upstream ${res.status}` }, { status: 502 });
    }
    const data = await res.json();

    const raw: unknown[] = data?.search?.results ?? [];
    const results: VerseHit[] = raw.flatMap((r) => {
      const item = r as {
        verse_key?: string;
        text?: string;
        translations?: { text?: string }[];
      };
      if (!item.verse_key) return [];
      const [s, a] = item.verse_key.split(":").map(Number);
      if (!s || !a) return [];
      return [{
        verseKey:    item.verse_key,
        surah:       s,
        ayah:        a,
        arabic:      item.text ?? "",
        // Upstream marks matches with <em>; the UI does its own highlighting
        // from the normalised query, so the markup is stripped rather than
        // trusted and injected.
        translation: plainTranslation(item.translations?.[0]?.text),
      }];
    });

    /* Search hits carry Quran.com's search text, not the encoding the King
       Fahd face is built for; swap in qpc by key (lib/quran-text). A sūrah
       that fails to load keeps its hit's own text. */
    const surahs = [...new Set(results.map((r) => r.surah))];
    const qpc = await Promise.all(surahs.map((n) => fetchQpcSurah(n).catch(() => ({} as Record<string, string>))));
    const byKey: Record<string, string> = Object.assign({}, ...qpc);
    for (const r of results) if (byKey[r.verseKey]) r.arabic = byKey[r.verseKey];

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[api] quran/search:", e);
    return NextResponse.json({ results: [], error: "Search is unavailable." }, { status: 500 });
  }
}
