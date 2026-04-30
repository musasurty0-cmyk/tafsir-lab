import { unstable_cache } from "next/cache";
import type { Chapter, Verse } from "./types";

const BASE = "https://api.quran.com/api/v4";

// ── Raw fetchers (called by the cached wrappers below) ─────────────────────

async function _fetchChapters(): Promise<Chapter[]> {
  const res = await fetch(`${BASE}/chapters?language=en`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`chapters fetch failed: ${res.status}`);
  const data = await res.json();
  return data.chapters as Chapter[];
}

async function _fetchChapter(id: number): Promise<Chapter> {
  const res = await fetch(`${BASE}/chapters/${id}?language=en`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`chapter ${id} fetch failed: ${res.status}`);
  const data = await res.json();
  return data.chapter as Chapter;
}

async function _fetchVerses(surahId: number): Promise<Verse[]> {
  const params = new URLSearchParams({
    language: "en",
    words: "true",
    translations: "20",
    fields: "text_uthmani",
    word_fields: "text_uthmani,transliteration",
    per_page: "286", // max per page — avoids pagination for all but Al-Baqarah
    page: "1",
  });

  const all: Verse[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    params.set("page", String(page));
    const res = await fetch(
      `${BASE}/verses/by_chapter/${surahId}?${params}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`verses fetch failed: ${res.status}`);
    const data = await res.json();
    if (!data.verses) throw new Error(`Unexpected API response: ${JSON.stringify(data).slice(0, 200)}`);
    all.push(...data.verses);
    totalPages = (data.pagination ?? data.meta)?.total_pages ?? 1;
    page++;
  }

  return all;
}

// ── Cached exports ─────────────────────────────────────────────────────────
// unstable_cache stores results in Next.js's shared data cache (persists across
// Lambda invocations on Vercel). Quran text never changes so 24-hour TTL is safe.

export const fetchChapters = unstable_cache(
  _fetchChapters,
  ["quran-chapters"],
  { revalidate: 86400, tags: ["quran"] }
);

export const fetchChapter = unstable_cache(
  _fetchChapter,
  ["quran-chapter"],
  { revalidate: 86400, tags: ["quran"] }
);

export const fetchVerses = unstable_cache(
  _fetchVerses,
  ["quran-verses"],
  { revalidate: 86400, tags: ["quran"] }
);

export async function fetchWordDetails(wordKey: string) {
  // wordKey format: "surahId:verseId:wordPosition"
  const [surahId, verseId, position] = wordKey.split(":").map(Number);
  const res = await fetch(
    `${BASE}/verses/by_key/${surahId}:${verseId}?language=en&words=true&translations=20&fields=text_uthmani&word_fields=text_uthmani,transliteration,text_indopak`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error(`word fetch failed: ${res.status}`);
  const data = await res.json();
  const verse = data.verse;
  const word = verse.words?.[position - 1];
  return { verse, word };
}
