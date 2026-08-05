import { NextResponse } from "next/server";

/**
 * Every āyah of one surah, trimmed to what the picker shows.
 *
 * Stage two of /ayah lists a whole surah, so this returns the number, the
 * Arabic and a short translation and nothing else — the full verse payload
 * carries word-by-word data the list never renders.
 */

const BASE = "https://api.quran.com/api/v4";

export interface AyahRow { ayah: number; arabic: string; translation?: string }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surah: string }> },
) {
  const { surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) {
    return NextResponse.json({ error: "surah out of range" }, { status: 400 });
  }

  try {
    const p = new URLSearchParams({
      language: "en",
      translations: "20",
      fields: "text_uthmani",
      per_page: "286",           // longest surah, so never paginates
      page: "1",
    });
    const res = await fetch(`${BASE}/verses/by_chapter/${n}?${p}`, {
      // A surah's text never changes; cache hard and share between users.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ verses: [], error: `upstream ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const verses: AyahRow[] = (data.verses ?? []).map((v: {
      verse_number: number; text_uthmani?: string; translations?: { text?: string }[];
    }) => ({
      ayah: v.verse_number,
      arabic: v.text_uthmani ?? "",
      translation: v.translations?.[0]?.text?.replace(/<[^>]+>/g, "").trim(),
    }));
    return NextResponse.json({ verses });
  } catch (e) {
    console.error("[api] quran/surah/verses:", e);
    return NextResponse.json({ verses: [], error: "Could not load these verses." }, { status: 500 });
  }
}
