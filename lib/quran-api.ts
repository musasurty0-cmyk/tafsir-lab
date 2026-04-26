import type { Chapter, Verse, VerseResponse } from "./types";

const BASE = "https://api.quran.com/api/v4";

export async function fetchChapters(): Promise<Chapter[]> {
  const res = await fetch(`${BASE}/chapters?language=en`, {
    next: { revalidate: 86400 }, // cache 24h
  });
  if (!res.ok) throw new Error(`chapters fetch failed: ${res.status}`);
  const data = await res.json();
  return data.chapters as Chapter[];
}

export async function fetchChapter(id: number): Promise<Chapter> {
  const res = await fetch(`${BASE}/chapters/${id}?language=en`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`chapter ${id} fetch failed: ${res.status}`);
  const data = await res.json();
  return data.chapter as Chapter;
}

export async function fetchVerses(surahId: number): Promise<Verse[]> {
  const params = new URLSearchParams({
    language: "en",
    words: "true",
    translations: "20", // Saheeh International (ID 20)
    fields: "text_uthmani",
    word_fields: "text_uthmani,transliteration",
    per_page: "50",
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
    // API returns either data.pagination or data.meta depending on version
    totalPages = (data.pagination ?? data.meta)?.total_pages ?? 1;
    page++;
  }

  return all;
}

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
