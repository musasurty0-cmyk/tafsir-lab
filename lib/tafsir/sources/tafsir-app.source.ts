/**
 * TafsirAppSource — server-side scraper for tafsir.app
 *
 * tafsir.app serves Arabic tafsir texts at URLs of the form:
 *   https://tafsir.app/{slug}/{surah}/{ayah}
 *
 * This source fetches the HTML server-side and extracts the tafsir text
 * without any client-side scraping. No third-party HTML parser dependency
 * is required — extraction uses targeted regex over the rendered HTML.
 *
 * Available slugs (non-exhaustive):
 *   tabari    — Tafsīr al-Ṭabarī
 *   muyassar  — Al-Tafsīr al-Muyassar
 *   saadi     — Tafsīr al-Saʿdī
 *   kathir    — Ibn Kathīr (Arabic, alternate source)
 *   qurtubi   — Al-Qurṭubī
 *   baghawy   — Al-Baghawī
 *
 * IMPORTANT: This scraper is provided as an architecture placeholder.
 * tafsir.app's HTML structure may change. If extraction fails, the job
 * records an error and continues with the next verse — no silent data loss.
 *
 * Prefer QuranApiTafsirSource for bulk ingestion; enable this source only
 * after validating the output against a sample set.
 */

import type { FetchedEntry, ITafsirSource, TafsirAppSourceConfig } from "../types";

const BASE_URL = "https://tafsir.app";

// Generous timeout — tafsir.app may be slow under load
const FETCH_TIMEOUT_MS = 15_000;

// Polite rate limit between verse requests
export const RATE_LIMIT_MS = 800;

export class TafsirAppSource implements ITafsirSource {
  constructor(private readonly config: TafsirAppSourceConfig) {}

  async fetchVerse(surahNumber: number, ayahNumber: number): Promise<FetchedEntry> {
    const verseKey = `${surahNumber}:${ayahNumber}`;
    const url = `${BASE_URL}/${this.config.slug}/${surahNumber}/${ayahNumber}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "TafsirLab/1.0 (+https://github.com/tafsirlab; research tool)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ar,en;q=0.8",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const content = extractContent(html, verseKey, this.config.slug);
    return { verseKey, content };
  }
}

// ── Content extraction ────────────────────────────────────────────────────

/**
 * Extract the tafsir body text from tafsir.app's rendered HTML.
 *
 * tafsir.app (as of 2026) is a Nuxt SSR application. The tafsir text
 * is rendered inside a <div> with data attribute or class containing
 * the word "tafsir" or "ayah-body". We try multiple patterns and use
 * the longest match (most likely to be the actual tafsir, not navigation).
 */
function extractContent(html: string, verseKey: string, slug: string): string {
  // Remove script and style blocks first
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Patterns to try, in order of specificity
  const patterns: RegExp[] = [
    // Nuxt data-v-* component content blocks (class names vary by build)
    /<div[^>]+class="[^"]*(?:tafsir[-_]?(?:text|body|content)|ayah[-_]?(?:text|body))[^"]*"[^>]*>([\s\S]+?)<\/div>/i,
    // Generic article tag (some pages wrap content here)
    /<article[^>]*>([\s\S]+?)<\/article>/i,
    // Main content area
    /<main[^>]*>([\s\S]+?)<\/main>/i,
    // Broadest fallback: longest <div> with Arabic text
    /<div[^>]*>([\u0600-\u06FF\s،؛.!?]+(?:[\s\S]*?)[\u0600-\u06FF]+)<\/div>/,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const text = stripTags(match[1]).trim();
      if (text.length > 50 && containsArabic(text)) {
        candidates.push(text);
      }
    }
  }

  if (candidates.length === 0) {
    // Last resort: extract all Arabic text from the page
    const allArabic = extractAllArabicText(cleaned);
    if (allArabic.length > 100) {
      return allArabic;
    }
    throw new Error(
      `Could not extract tafsir content for ${verseKey} from tafsir.app/${slug}. ` +
      `The site HTML structure may have changed.`
    );
  }

  // Return the longest candidate (most likely to be the full tafsir text)
  return candidates.reduce((a, b) => (a.length >= b.length ? a : b));
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function extractAllArabicText(html: string): string {
  // Collect all runs of Arabic text
  const arabicRuns = [...html.matchAll(/[\u0600-\u06FF][^<]{10,}/g)];
  return arabicRuns
    .map((m) => m[0].replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 20)
    .join("\n");
}
