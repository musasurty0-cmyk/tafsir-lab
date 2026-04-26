#!/usr/bin/env tsx
/**
 * ingest-tafsir — CLI wrapper around the tafsir ingestion orchestrator.
 *
 * Usage:
 *   npm run tafsir:ingest -- --source ibn-kathir-en --surah 1
 *   npm run tafsir:ingest -- --source ibn-kathir-en --all
 *   npm run tafsir:ingest -- --source ibn-kathir-ar --surah 2 --force
 *   npm run tafsir:ingest -- --list-sources
 *   npm run tafsir:ingest -- --source ibn-kathir-en --mark-stale
 *
 * Options:
 *   --source <slug>      TafsirSource slug (required unless --list-sources)
 *   --surah <n>          Ingest one surah (1–114)
 *   --all                Ingest all 114 surahs
 *   --start-from <n>     Used with --all to resume from a specific surah
 *   --force              Re-ingest even if entries already exist
 *   --mark-stale         Flag all entries for this source as stale
 *   --list-sources       Print available TafsirSource records and exit
 *   --verbose            Print per-verse progress
 *   --dry-run            Print what would be done; make no DB writes
 */

import { PrismaClient } from "@prisma/client";
import { ingestSurah, ingestAllSurahs, markSourceStale } from "@/lib/tafsir/ingest";

const db = new PrismaClient();

// ── Parse args ────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const source    = arg("--source");
  const surahArg  = arg("--surah");
  const startFrom = arg("--start-from");
  const all       = flag("--all");
  const force     = flag("--force");
  const verbose   = flag("--verbose");
  const dryRun    = flag("--dry-run");
  const listSrcs  = flag("--list-sources");
  const stale     = flag("--mark-stale");

  // ── List sources ─────────────────────────────────────────────────────
  if (listSrcs) {
    const sources = await db.tafsirSource.findMany({
      include: { _count: { select: { entries: true, fetchJobs: true } } },
      orderBy: { language: "asc" },
    });

    console.log("\nAvailable TafsirSources:\n");
    console.log(
      "  Slug                  Language  Type    Active  Entries  Jobs"
    );
    console.log(
      "  ─────────────────────────────────────────────────────────────"
    );
    for (const s of sources) {
      const cols = [
        s.slug.padEnd(22),
        s.language.padEnd(10),
        s.type.padEnd(8),
        (s.isActive ? "yes" : "no").padEnd(8),
        String(s._count.entries).padEnd(9),
        String(s._count.fetchJobs),
      ];
      console.log("  " + cols.join(""));
    }
    console.log();
    return;
  }

  // ── Validate ──────────────────────────────────────────────────────────
  if (!source) {
    console.error("Error: --source <slug> is required.\n");
    console.error("Run with --list-sources to see available sources.");
    process.exit(1);
  }

  if (!all && !surahArg && !stale) {
    console.error("Error: one of --surah <n>, --all, or --mark-stale is required.\n");
    process.exit(1);
  }

  // ── Mark stale ────────────────────────────────────────────────────────
  if (stale) {
    if (dryRun) {
      console.log(`[dry-run] Would mark all entries for "${source}" as stale`);
    } else {
      const count = await markSourceStale(source);
      console.log(`Marked ${count} entries stale for source "${source}"`);
    }
    return;
  }

  // ── Dry-run banner ────────────────────────────────────────────────────
  if (dryRun) {
    console.log("⚠  Dry-run mode — no DB writes will be performed\n");
  }

  // ── Ingest ────────────────────────────────────────────────────────────
  console.log(`\n🔄 Tafsir ingestion: source="${source}"`, all ? "all surahs" : `surah ${surahArg}`);
  if (force)   console.log("   --force: re-ingesting even if entries exist");
  if (verbose) console.log("   --verbose: per-verse logging enabled");
  console.log();

  const opts = { force, verbose };

  if (all) {
    const fromSurah = startFrom ? parseInt(startFrom, 10) : 1;
    if (isNaN(fromSurah) || fromSurah < 1 || fromSurah > 114) {
      console.error("Error: --start-from must be 1–114");
      process.exit(1);
    }

    if (!dryRun) {
      const results = await ingestAllSurahs(source, { ...opts, startFrom: fromSurah });
      summarize(results);
    } else {
      console.log(
        `[dry-run] Would ingest surahs ${fromSurah}–114 from "${source}"`
      );
    }
  } else {
    const surahNum = parseInt(surahArg!, 10);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
      console.error("Error: --surah must be 1–114");
      process.exit(1);
    }

    if (!dryRun) {
      const result = await ingestSurah(source, surahNum, opts);
      summarize([result]);
    } else {
      console.log(`[dry-run] Would ingest surah ${surahNum} from "${source}"`);
    }
  }
}

function summarize(results: Awaited<ReturnType<typeof ingestAllSurahs>>) {
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalSkipped  = results.reduce((s, r) => s + r.skipped, 0);
  const totalErrors   = results.reduce((s, r) => s + r.errors, 0);
  const totalMs       = results.reduce((s, r) => s + r.durationMs, 0);

  console.log("\n────────────────────────────────────────");
  console.log(`  ✓ Inserted : ${totalInserted}`);
  console.log(`  → Skipped  : ${totalSkipped}`);
  if (totalErrors > 0) {
    console.log(`  ✗ Errors   : ${totalErrors}  ← check logs above`);
  }
  console.log(`  ⏱ Duration : ${(totalMs / 1000).toFixed(1)}s`);
  console.log("────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("\nFatal error:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
