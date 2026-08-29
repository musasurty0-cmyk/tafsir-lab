/**
 * Spa5kTafsirSource — fetches tafsir from the spa5k/tafsir_api static CDN.
 *
 * The dataset is a GitHub repo of pre-generated JSON served via jsDelivr:
 *   https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/{slug}/{surah}/{ayah}.json
 *   → { "text": "..." }   (some editions embed light HTML in `text`)
 *
 * The repo also publishes a whole-surah file:
 *   https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/{slug}/{surah}.json
 *   → [ { "text": "..." }, … ]   (one element per ayah, in order)
 *
 * fetchSurah uses it. Ingesting fourteen editions one verse at a time is
 * ~87,000 requests against a free CDN for data that comes back in ~1,600.
 *
 * Static files = no auth, no rate limits, immutable content — the cheapest
 * source type in the pipeline. Edition catalog lives in ../spa5k-catalog.ts.
 */

import type { FetchedEntry, ITafsirSource, Spa5kSourceConfig } from "../types";

const CDN = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";

/**
 * Immutable static files on a public CDN, so there is no quota to respect and
 * no per-verse pause to make. The pause that matters is between SURAHS, and
 * with fetchSurah that is 114 requests per edition rather than 6,236.
 */
export const RATE_LIMIT_MS = 120;

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

  async fetchSurah(surahNumber: number): Promise<FetchedEntry[]> {
    const url = `${CDN}/${this.config.slug}/${surahNumber}.json`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache:   "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `spa5k CDN error ${res.status} for surah ${surahNumber} (edition=${this.config.slug})`
      );
    }

    const data = await res.json() as unknown;
    if (!Array.isArray(data)) {
      throw new Error(`Unexpected surah payload for ${this.config.slug}/${surahNumber}`);
    }

    const out: FetchedEntry[] = [];
    data.forEach((item, i) => {
      const raw = String((item as { text?: string })?.text ?? "").trim();
      // An empty verse is a gap in the edition, not a failure: skip it rather
      // than abort the surah and lose the other 285 verses.
      if (!raw) return;
      const hasHtml = /<[a-z][^>]*>/i.test(raw);
      out.push({
        verseKey:    `${surahNumber}:${i + 1}`,
        content:     hasHtml ? stripHtml(raw) : raw,
        contentHtml: hasHtml ? raw : undefined,
      });
    });
    return out;
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
