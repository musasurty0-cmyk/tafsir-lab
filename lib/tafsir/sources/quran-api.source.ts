/**
 * QuranApiTafsirSource — fetches tafsir from api.quran.com
 *
 * Supports any tafsir ID available on the Quran.com platform, including:
 *   169 — Ibn Kathīr (English)
 *    91 — Ibn Kathīr (Arabic)
 *    16 — Al-Jalalayn
 *
 * Full catalog: GET https://api.quran.com/api/v4/tafsirs?language=en
 */

import type { FetchedEntry, ITafsirSource, QuranApiSourceConfig } from "../types";

const BASE = "https://api.quran.com/api/v4";

// Rate-limit: be polite to the API (also avoids 429s on bulk runs).
// Each ingest loop awaits this between verses.
export const RATE_LIMIT_MS = 120;

export class QuranApiTafsirSource implements ITafsirSource {
  constructor(private readonly config: QuranApiSourceConfig) {}

  async fetchVerse(surahNumber: number, ayahNumber: number): Promise<FetchedEntry> {
    const verseKey = `${surahNumber}:${ayahNumber}`;
    const url = `${BASE}/tafsirs/${this.config.tafsirId}/by_ayah/${verseKey}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // No Next.js caching — ingestion always needs fresh data
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(
        `Quran.com API error ${res.status} for ${verseKey} (tafsirId=${this.config.tafsirId})`
      );
    }

    const data = await res.json() as {
      tafsir?: { text?: string; resource_id?: number };
    };

    const contentHtml = data.tafsir?.text ?? "";

    // Strip HTML tags for plain-text storage
    const content = stripHtml(contentHtml).trim();

    if (!content) {
      throw new Error(`Empty tafsir content for ${verseKey}`);
    }

    return { verseKey, content, contentHtml: contentHtml || undefined };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Minimal HTML → plain-text conversion without a DOM parser dependency.
 * Handles the subset of HTML quran.com returns:
 *   <p>, <em>, <b>, <i>, <strong>, <br>, <sup>, <span>, <div>, <h3>
 */
function stripHtml(html: string): string {
  return html
    // Block elements → preserve paragraph breaks
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    // Remove all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    // Collapse excessive whitespace / blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
