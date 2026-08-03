/**
 * Surah information — introductions, not commentary.
 *
 * Deliberately a SEPARATE endpoint from /api/tafsir. This material describes a
 * Surah as a whole (its name, period of revelation, historical background and
 * themes); it is not a mufassir's verse-by-verse commentary, and mixing the two
 * would present it as something it is not.
 *
 * Served one Surah at a time. The source file is ~918KB across 114 entries, so
 * shipping it in the client bundle would cost every page load for something a
 * reader opens occasionally.
 */

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeTafsirHtml } from "@/lib/sanitize-html";

interface SurahInfoEntry {
  surah_number: number;
  surah_name:   string;
  text:         string;
  short_text:   string;
}

/* Read once per server process. The file never changes at runtime, so parsing
   it on every request would be pure waste. */
let cache: Record<string, SurahInfoEntry> | null = null;
let loading: Promise<Record<string, SurahInfoEntry>> | null = null;

async function load(): Promise<Record<string, SurahInfoEntry>> {
  if (cache) return cache;
  if (!loading) {
    loading = readFile(path.join(process.cwd(), "data", "surah-info-en.json"), "utf8")
      .then((raw) => {
        cache = JSON.parse(raw) as Record<string, SurahInfoEntry>;
        return cache;
      })
      .catch((e) => {
        loading = null;               // let a later request retry
        throw e;
      });
  }
  return loading;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surahNumber: string }> },
) {
  const { surahNumber } = await params;
  const n = parseInt(surahNumber, 10);
  if (!Number.isInteger(n) || n < 1 || n > 114) {
    return NextResponse.json({ error: "Surah must be 1–114" }, { status: 400 });
  }

  try {
    const all   = await load();
    const entry = all[String(n)];
    if (!entry) return NextResponse.json({ error: "No information for this Surah" }, { status: 404 });

    return NextResponse.json({
      info: {
        surahNumber: entry.surah_number,
        surahName:   entry.surah_name,
        /* Third-party HTML. The same sanitiser the tafsīr content uses — the
           source carries ~446 anchor tags across the file, and script/style/
           event handlers must not survive into the drawer. */
        html:  sanitizeTafsirHtml(entry.text ?? ""),
        short: entry.short_text ?? "",
        /* The material is the Surah introduction from Sayyid Abul Aʿla
           Mawdūdī's Tafhīm al-Qurʾān, which is what the bundled dataset is.
           Attribution travels with the content rather than being implied. */
        source: "Tafhīm al-Qurʾān — Surah introduction",
      },
    }, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return NextResponse.json({ error: "Surah information is unavailable" }, { status: 500 });
  }
}
