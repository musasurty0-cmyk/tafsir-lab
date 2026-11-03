import { unstable_cache } from "next/cache";
import type { Chapter, Verse, Word } from "./types";

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
    fields: "text_uthmani,text_qpc_hafs,page_number",
    word_fields: "text_uthmani,text_qpc_hafs,transliteration",
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
    all.push(...data.verses.map(slimVerse));
    totalPages = (data.pagination ?? data.meta)?.total_pages ?? 1;
    page++;
  }

  return all;
}

// The API returns far more than the `Verse` type declares (hizb/juz/ruku
// numbers, a per-word text_uthmani identical to `text`, per-word page and line
// numbers…). Unslimmed, Al-Baqarah is ~2.3 MB, over the data cache's 2 MB item
// limit, so it was refetched on every view. Keep only what the type declares.
function slimWord(w: Word): Word {
  return {
    id:              w.id,
    position:        w.position,
    audio_url:       w.audio_url,
    char_type_name:  w.char_type_name,
    /* What the King Fahd face is built for (lib/quran-text). */
    text:            (w as Word & { text_qpc_hafs?: string }).text_qpc_hafs || w.text,
    transliteration: { text: w.transliteration?.text },
    translation:     { text: w.translation?.text, language_name: w.translation?.language_name },
  };
}

function slimVerse(v: Verse): Verse {
  return {
    id:           v.id,
    verse_number: v.verse_number,
    verse_key:    v.verse_key,
    text_uthmani: v.text_uthmani,
    text_qpc_hafs: v.text_qpc_hafs,
    page_number:  v.page_number,
    words:        (v.words ?? []).map(slimWord),
    translations: (v.translations ?? []).map((t) => ({ resource_id: t.resource_id, text: t.text })),
  };
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
  // v2: verses carry text_qpc_hafs. A new key, so day-old entries without it
  // are not served for another 24 hours.
  ["quran-verses-v2"],
  { revalidate: 86400, tags: ["quran"] }
);

export async function fetchWordDetails(wordKey: string) {
  // wordKey format: "surahId:verseId:wordPosition"
  const [surahId, verseId, position] = wordKey.split(":").map(Number);
  const res = await fetch(
    `${BASE}/verses/by_key/${surahId}:${verseId}?language=en&words=true&translations=20&fields=text_uthmani,text_qpc_hafs&word_fields=text_uthmani,text_qpc_hafs,transliteration`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error(`word fetch failed: ${res.status}`);
  const data = await res.json();
  const verse = data.verse;
  const word = verse.words?.[position - 1];
  return { verse, word };
}

/* A sūrah's āyāt in qpc_hafs, keyed "s:a": for responses that carry some
   other encoding (search hits) and must show the one the King Fahd face is
   built for (lib/quran-text). About 30 KB a sūrah, shared and cached a day. */
async function _fetchQpcSurah(surah: number): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/quran/verses/qpc_hafs?chapter_number=${surah}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`qpc ${surah} fetch failed: ${res.status}`);
  const data = await res.json() as { verses?: { verse_key: string; text_qpc_hafs: string }[] };
  return Object.fromEntries((data.verses ?? []).map((v) => [v.verse_key, v.text_qpc_hafs]));
}

export const fetchQpcSurah = unstable_cache(
  _fetchQpcSurah,
  ["quran-qpc-surah"],
  { revalidate: 86400, tags: ["quran"] }
);
