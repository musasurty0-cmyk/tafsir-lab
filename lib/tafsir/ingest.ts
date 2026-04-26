/**
 * Tafsir ingestion orchestrator
 *
 * Coordinates TafsirFetchJob lifecycle and bulk ingestion of verses.
 * Called by the CLI script (scripts/ingest-tafsir.ts).
 *
 * Usage:
 *   import { ingestSurah, ingestAllSurahs } from "@/lib/tafsir/ingest";
 *
 *   // Ingest one surah from one source
 *   const result = await ingestSurah("ibn-kathir-en", 1);
 *
 *   // Ingest all 114 surahs from one source
 *   const results = await ingestAllSurahs("ibn-kathir-en");
 */

import { db } from "@/lib/db";
import { QuranApiTafsirSource, RATE_LIMIT_MS as API_RATE_LIMIT } from "./sources/quran-api.source";
import { TafsirAppSource, RATE_LIMIT_MS as SCRAPE_RATE_LIMIT } from "./sources/tafsir-app.source";
import type {
  ITafsirSource,
  IngestResult,
  QuranApiSourceConfig,
  TafsirAppSourceConfig,
} from "./types";

// Verse counts per surah (standard Hafs reading)
const VERSE_COUNTS: number[] = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
  59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
  52,52,44,28,28,20,56,40,31,50,22,33,30,26,28,30,28,27,33,30,26,28,30,28,
  27,33,30,26,28,28,22,23,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,
  31,50,22,33,30,26,28,
];

// True verse counts (verified, 114 surahs)
const AYAH_COUNTS: Record<number, number> = {
   1:7,   2:286, 3:200, 4:176, 5:120, 6:165, 7:206, 8:75,  9:129, 10:109,
  11:123,12:111,13:43, 14:52, 15:99, 16:128,17:111,18:110,19:98, 20:135,
  21:112,22:78, 23:118,24:64, 25:77, 26:227,27:93, 28:88, 29:69, 30:60,
  31:34, 32:30, 33:73, 34:54, 35:45, 36:83, 37:182,38:88, 39:75, 40:85,
  41:54, 42:53, 43:89, 44:59, 45:37, 46:35, 47:38, 48:29, 49:18, 50:45,
  51:60, 52:49, 53:62, 54:55, 55:78, 56:96, 57:29, 58:22, 59:24, 60:13,
  61:14, 62:11, 63:11, 64:18, 65:12, 66:12, 67:30, 68:52, 69:52, 70:44,
  71:28, 72:28, 73:20, 74:56, 75:40, 76:31, 77:50, 78:40, 79:46, 80:42,
  81:29, 82:19, 83:36, 84:25, 85:22, 86:17, 87:19, 88:26, 89:30, 90:20,
  91:15, 92:21, 93:11, 94:8,  95:8,  96:19, 97:5,  98:8,  99:8, 100:11,
 101:11,102:8, 103:3, 104:9, 105:5, 106:4, 107:7, 108:3, 109:6, 110:3,
 111:5, 112:4, 113:5, 114:6,
};

// ── Source factory ────────────────────────────────────────────────────────

function buildSource(type: string, config: unknown): { source: ITafsirSource; rateLimitMs: number } {
  if (type === "api") {
    const cfg = config as QuranApiSourceConfig;
    return {
      source: new QuranApiTafsirSource(cfg),
      rateLimitMs: API_RATE_LIMIT,
    };
  }
  if (type === "scrape") {
    const cfg = config as TafsirAppSourceConfig;
    return {
      source: new TafsirAppSource(cfg),
      rateLimitMs: SCRAPE_RATE_LIMIT,
    };
  }
  throw new Error(`Unknown source type: ${type}`);
}

// ── Ingest one surah ──────────────────────────────────────────────────────

export async function ingestSurah(
  sourceSlug: string,
  surahNumber: number,
  opts: { force?: boolean; verbose?: boolean } = {}
): Promise<IngestResult> {
  const { force = false, verbose = false } = opts;
  const log = verbose ? console.log : () => {};
  const t0 = Date.now();

  if (surahNumber < 1 || surahNumber > 114) {
    throw new Error(`Invalid surah number: ${surahNumber}. Must be 1–114.`);
  }

  // ── Load source config from DB ─────────────────────────────────────────
  const sourceRow = await db.tafsirSource.findUnique({ where: { slug: sourceSlug } });
  if (!sourceRow) throw new Error(`TafsirSource not found: "${sourceSlug}". Run db:seed-minimal first.`);
  if (!sourceRow.isActive && !force) {
    throw new Error(`Source "${sourceSlug}" is inactive. Pass --force to override.`);
  }

  const { source, rateLimitMs } = buildSource(sourceRow.type, sourceRow.config);

  // ── Upsert fetch job ───────────────────────────────────────────────────
  const job = await db.tafsirFetchJob.upsert({
    where:  { sourceId_surahNumber: { sourceId: sourceRow.id, surahNumber } },
    update: { status: "running", startedAt: new Date(), error: null, recordsInserted: 0 },
    create: { sourceId: sourceRow.id, surahNumber, status: "running", startedAt: new Date() },
  });

  const ayahCount = AYAH_COUNTS[surahNumber];
  if (!ayahCount) throw new Error(`No verse count defined for surah ${surahNumber}`);

  log(`\n▶  Ingesting surah ${surahNumber} from "${sourceSlug}" (${ayahCount} verses)`);

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  for (let ayah = 1; ayah <= ayahCount; ayah++) {
    const verseKey = `${surahNumber}:${ayah}`;

    // Skip if already have a fresh entry (unless force)
    if (!force) {
      const existing = await db.tafsirEntry.findUnique({
        where: { sourceId_verseKey: { sourceId: sourceRow.id, verseKey } },
        select: { id: true, isStale: true },
      });
      if (existing && !existing.isStale) {
        log(`  skip  ${verseKey} (already ingested)`);
        skipped++;
        continue;
      }
    }

    try {
      const entry = await source.fetchVerse(surahNumber, ayah);

      await db.tafsirEntry.upsert({
        where:  { sourceId_verseKey: { sourceId: sourceRow.id, verseKey } },
        update: {
          content:     entry.content,
          contentHtml: entry.contentHtml ?? null,
          fetchedAt:   new Date(),
          isStale:     false,
        },
        create: {
          sourceId:    sourceRow.id,
          verseKey,
          content:     entry.content,
          contentHtml: entry.contentHtml ?? null,
        },
      });

      inserted++;
      log(`  ✓  ${verseKey}`);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  ${verseKey}: ${msg}`);
    }

    // Rate limit between verses
    if (ayah < ayahCount) {
      await sleep(rateLimitMs);
    }
  }

  // ── Update job record ──────────────────────────────────────────────────
  const status: string = errors > 0 && inserted === 0 ? "failed" : "done";
  await db.tafsirFetchJob.update({
    where:  { id: job.id },
    data:   {
      status,
      completedAt:     new Date(),
      recordsInserted: inserted,
      error: errors > 0 ? `${errors} verse(s) failed` : null,
    },
  });

  const result: IngestResult = {
    sourceSlug,
    surahNumber,
    inserted,
    skipped,
    errors,
    durationMs: Date.now() - t0,
  };

  log(
    `\n  Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors` +
    ` in ${(result.durationMs / 1000).toFixed(1)}s\n`
  );

  return result;
}

// ── Ingest all 114 surahs ─────────────────────────────────────────────────

export async function ingestAllSurahs(
  sourceSlug: string,
  opts: { force?: boolean; verbose?: boolean; startFrom?: number } = {}
): Promise<IngestResult[]> {
  const { startFrom = 1 } = opts;
  const results: IngestResult[] = [];

  for (let surah = startFrom; surah <= 114; surah++) {
    const result = await ingestSurah(sourceSlug, surah, opts);
    results.push(result);

    const total   = results.reduce((s, r) => s + r.inserted, 0);
    const errored = results.reduce((s, r) => s + r.errors, 0);
    console.log(
      `  Surah ${surah}/114 complete — ${total} total inserted, ${errored} total errors`
    );
  }

  return results;
}

// ── Mark stale ────────────────────────────────────────────────────────────

/**
 * Mark all entries for a source as stale (triggers re-fetch on next ingest).
 * Useful when a new version of the source content is available.
 */
export async function markSourceStale(sourceSlug: string): Promise<number> {
  const source = await db.tafsirSource.findUnique({ where: { slug: sourceSlug } });
  if (!source) throw new Error(`Source not found: ${sourceSlug}`);

  const { count } = await db.tafsirEntry.updateMany({
    where:  { sourceId: source.id },
    data:   { isStale: true },
  });

  return count;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
