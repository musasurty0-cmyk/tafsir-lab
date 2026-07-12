/**
 * Spa5kTafsirSource — fetches tafsir from the spa5k/tafsir_api static CDN.
 *
 * The dataset is a GitHub repo of pre-generated JSON served via jsDelivr:
 *   https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/{slug}/{surah}/{ayah}.json
 *   → { "text": "..." }   (some editions embed light HTML in `text`)
 *
 * Static files = no auth, no rate limits, immutable content — the cheapest
 * source type in the pipeline. Edition catalog lives in ../spa5k-catalog.ts.
 */

import type { FetchedEntry, ITafsirSource, Spa5kSourceConfig } from "../types";

const CDN = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";

export class Spa5kTafsirSource implements ITafsirSource {
  constructor(private readonly config: Spa5kSourceConfig) {}

  async fetchVerse(surahNumber: number, ayahNumber: number): Promise<FetchedEntry> {
    const verseKey = `${surahNumber}:${ayahNumber}`;
    const url = `${CDN}/${this.config.slug}/${surahNumber}/${ayahNumber}.json`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache:   "no-store",
    });

    if (!res.ok) {
      throw new Error(
        `spa5k CDN error ${res.status} for ${verseKey} (edition=${this.config.slug})`
      );
    }

    const data = await res.json() as { text?: string };
    const raw  = (data.text ?? "").trim();

    if (!raw) {
      throw new Error(`Empty tafsir content for ${verseKey} (edition=${this.config.slug})`);
    }

    // Some editions carry light HTML markup in `text`; keep it as contentHtml
    // and store a stripped plain-text version alongside (same contract as the
    // quran.com source).
    const hasHtml = /<[a-z][^>]*>/i.test(raw);
    const content = hasHtml ? stripHtml(raw) : raw;

    return {
      verseKey,
      content,
      contentHtml: hasHtml ? raw : undefined,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Minimal HTML → plain-text conversion (mirrors quran-api.source.ts). */
function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
