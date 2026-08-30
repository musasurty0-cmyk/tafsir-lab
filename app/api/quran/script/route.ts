/**
 * GET /api/quran/script?surah=<n>
 *   A sūrah's verses in the Uthmani mushaf script.
 *
 * Proxied so the response can be cached and shared between users — the Qurʾān
 * text does not change, so a chapter fetched once serves everyone — and so the
 * shape stays ours if the upstream field names move.
 *
 * Verses are returned as plain segments rather than as markup, so nothing from
 * upstream can reach the DOM as HTML. The client renders segments, never
 * innerHTML.
 */

import { NextRequest, NextResponse } from "next/server";

const API = "https://api.quran.com/api/v4/quran/verses";

/* One script. The app used to offer Indo-Pak, Tajweed colours and a plain
   spelling alongside Uthmani, which meant four renderings of the same āyah to
   keep consistent — and a reader choosing between them before they had a
   reason to care. Uthmani is the one the rest of the app quotes, annotates and
   searches against, so it is the one that stayed. */
export const SCRIPTS = [
  { id: "uthmani", label: "Uthmani", note: "Standard Madīnah script" },
] as const;

export type ScriptId = typeof SCRIPTS[number]["id"];

/** Upstream path and field for each of ours. */
const UPSTREAM: Record<ScriptId, { path: string; field: string }> = {
  uthmani: { path: "uthmani",         field: "text_uthmani" },
};

export interface Segment { text: string; rule?: string }
export interface ScriptVerse { verseKey: string; segments: Segment[] }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  const surah = Number(q.get("surah"));
  if (!Number.isInteger(surah) || surah < 1 || surah > 114)
    return NextResponse.json({ error: "surah must be 1-114" }, { status: 400 });

  const raw = q.get("script") ?? "uthmani";
  const script = (SCRIPTS.some((s) => s.id === raw) ? raw : "uthmani") as ScriptId;
  const { path, field } = UPSTREAM[script];

  try {
    const res = await fetch(`${API}/${path}?chapter_number=${surah}`,
      { next: { revalidate: 86400, tags: ["quran"] } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const data = await res.json() as { verses?: Record<string, string>[] };
    const verses: ScriptVerse[] = (data.verses ?? []).map((v) => {
      const text = String(v[field] ?? "");
      return {
        verseKey: String(v.verse_key ?? ""),
        segments: [{ text }],
      };
    });

    return NextResponse.json({ script, surah, verses, scripts: SCRIPTS });
  } catch {
    return NextResponse.json({ error: "Could not load that script" }, { status: 502 });
  }
}
