/**
 * GET /api/quran/audio?surah=<n>[&ayah=<n>][&reciter=<id>]
 *   Resolves a recitation to a playable URL.
 *
 *   With `ayah`  → that one verse.
 *   Without      → the whole sūrah as one file.
 *
 * Proxied for resolution only, not for the bytes: the browser streams the mp3
 * straight from the CDN, and passing tens of megabytes of audio through our
 * server would cost bandwidth for nothing. What this adds is a cached lookup
 * and a response shape that survives the upstream changing.
 */

import { NextRequest, NextResponse } from "next/server";

const API = "https://api.quran.com/api/v4";
/** Per-ayah responses carry a relative path; whole-surah ones are absolute. */
const VERSE_CDN = "https://verses.quran.foundation/";

/**
 * A small fixed roster rather than the upstream reciter list, which returned
 * 503 when this was written. These ids are stable public data, and a hard-coded
 * seven that always work beat a live list that sometimes does not.
 */
export const RECITERS: { id: number; name: string }[] = [
  { id: 7, name: "Mishary Alafasy" },
  { id: 1, name: "AbdulBaset (Mujawwad)" },
  { id: 2, name: "AbdulBaset (Murattal)" },
  { id: 3, name: "Abdur-Rahman as-Sudais" },
  { id: 4, name: "Abu Bakr al-Shatri" },
  { id: 5, name: "Hani ar-Rifai" },
  { id: 6, name: "Mahmoud Khalil Al-Husary" },
];

const DEFAULT_RECITER = 7;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  const surah = Number(q.get("surah"));
  if (!Number.isInteger(surah) || surah < 1 || surah > 114)
    return NextResponse.json({ error: "surah must be 1-114" }, { status: 400 });

  const ayahRaw = q.get("ayah");
  const ayah = ayahRaw == null ? null : Number(ayahRaw);
  if (ayah != null && (!Number.isInteger(ayah) || ayah < 1))
    return NextResponse.json({ error: "ayah must be a positive integer" }, { status: 400 });

  const rRaw = Number(q.get("reciter"));
  const reciter = RECITERS.some((x) => x.id === rRaw) ? rRaw : DEFAULT_RECITER;

  try {
    const upstream = ayah != null
      ? `${API}/recitations/${reciter}/by_ayah/${surah}:${ayah}`
      : `${API}/chapter_recitations/${reciter}/${surah}`;

    // Recitation files do not change, so a long cache is safe and makes a
    // repeated verse instant.
    const res = await fetch(upstream, { next: { revalidate: 86400, tags: ["quran-audio"] } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();

    let url: string | null = null;
    if (ayah != null) {
      const rel = data?.audio_files?.[0]?.url as string | undefined;
      // Absolute already on some responses — only prefix a relative path.
      if (rel) url = /^https?:\/\//.test(rel) ? rel : VERSE_CDN + rel;
    } else {
      url = data?.audio_file?.audio_url ?? null;
    }

    if (!url) return NextResponse.json({ error: "No recitation for that reference" }, { status: 404 });

    return NextResponse.json({ url, reciter, surah, ayah, reciters: RECITERS });
  } catch {
    // The caller shows "recitation unavailable" rather than a broken player.
    return NextResponse.json({ error: "Recitation lookup failed" }, { status: 502 });
  }
}
