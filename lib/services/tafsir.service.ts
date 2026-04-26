/**
 * tafsir.service — unified tafsir lookup
 *
 * Primary path: reads from TafsirEntry (pre-ingested, fast, no external calls).
 * Fallback path: if an entry doesn't exist yet, fetches on-demand from the
 *   source and persists it — so single-verse lookups work before a full
 *   bulk ingest has run.
 *
 * All UI reads tafsir ONLY through this service. No direct API calls in components.
 */

import { db } from "@/lib/db";
import { QuranApiTafsirSource } from "@/lib/tafsir/sources/quran-api.source";
import { TafsirAppSource }      from "@/lib/tafsir/sources/tafsir-app.source";
import type {
  ITafsirSource,
  QuranApiSourceConfig,
  TafsirAppSourceConfig,
  TafsirEntryResult,
  TafsirSourceMeta,
  UnifiedTafsirResponse,
} from "@/lib/tafsir/types";

// ── Default sources served when the caller doesn't specify ───────────────
const DEFAULT_SLUGS = ["ibn-kathir-en"] as const;

// ── Built-in source definitions (auto-provisioned on first use) ──────────
//
// IDs verified against api.quran.com/api/v4/resources/tafsirs:
//   169 — Ibn Kathīr (Abridged), English
//   168 — Maʿārif al-Qurʾān (Mufti Shafi), English
//    91 — Al-Saʿdī (Tayseer Al-Kareem Al-Rahman), Arabic
//    14 — Ibn Kathīr, Arabic (full)

const BUILTIN_SOURCES = [
  {
    slug:       "ibn-kathir-en",
    name:       "Ibn Kathīr (English)",
    nameArabic: "ابن كثير",
    language:   "en",
    type:       "api",
    config:     { provider: "quran.com", tafsirId: 169 },
    isActive:   true,
  },
  {
    slug:       "maarif-en",
    name:       "Maʿārif al-Qurʾān (English)",
    nameArabic: "معارف القرآن",
    language:   "en",
    type:       "api",
    config:     { provider: "quran.com", tafsirId: 168 },
    isActive:   true,
  },
  {
    slug:       "saadi-ar",
    name:       "Al-Saʿdī (Arabic)",
    nameArabic: "تيسير الكريم الرحمن",
    language:   "ar",
    type:       "api",
    config:     { provider: "quran.com", tafsirId: 91 },
    isActive:   true,
  },
] as const;

/**
 * Ensures the built-in TafsirSource rows exist in the DB.
 * Safe to call on every request — uses upsert so it's idempotent.
 * Only hits the DB when sources are missing (count check first).
 */
async function ensureDefaultSources(): Promise<void> {
  const count = await db.tafsirSource.count();
  if (count >= BUILTIN_SOURCES.length) return;

  for (const src of BUILTIN_SOURCES) {
    await db.tafsirSource.upsert({
      where:  { slug: src.slug },
      update: {},        // Don't clobber manual edits
      create: { ...src, config: src.config as object },
    });
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Return tafsir for a single verse from one or more sources.
 *
 * @param verseKey  "1:1" format
 * @param slugs     Source slugs to include. Defaults to ["ibn-kathir-en"].
 *                  Pass an empty array to return ALL active sources.
 */
export async function getTafsirForVerse(
  verseKey: string,
  slugs: string[] = [...DEFAULT_SLUGS]
): Promise<UnifiedTafsirResponse> {
  // Auto-provision sources on first use (idempotent)
  await ensureDefaultSources();

  // Load requested (or all active) sources from the DB
  const sources = await db.tafsirSource.findMany({
    where: slugs.length > 0
      ? { slug: { in: slugs }, isActive: true }
      : { isActive: true },
    orderBy: { language: "asc" },
  });

  const entries: TafsirEntryResult[] = await Promise.all(
    sources.map((src) => resolveEntry(src, verseKey))
  );

  return {
    verseKey,
    entries: entries.filter(Boolean),
  };
}

/**
 * Return a list of all available source metadata (for the source picker UI).
 * Also provisions default sources on first call so the drawer always has options.
 */
export async function listSources(): Promise<TafsirSourceMeta[]> {
  await ensureDefaultSources();
  const sources = await db.tafsirSource.findMany({
    where:   { isActive: true },
    orderBy: [{ language: "asc" }, { name: "asc" }],
    select:  { slug: true, name: true, nameArabic: true, language: true, type: true },
  });
  return sources;
}

// ── Internal helpers ──────────────────────────────────────────────────────

type SourceRow = {
  id:         string;
  slug:       string;
  name:       string;
  nameArabic: string | null;
  language:   string;
  type:       string;
  config:     unknown;
};

async function resolveEntry(
  src: SourceRow,
  verseKey: string
): Promise<TafsirEntryResult> {
  // 1. Try DB first (fast path — already ingested)
  const existing = await db.tafsirEntry.findUnique({
    where: { sourceId_verseKey: { sourceId: src.id, verseKey } },
    select: {
      content:     true,
      contentHtml: true,
      fetchedAt:   true,
      isStale:     true,
    },
  });

  if (existing && !existing.isStale) {
    return toResult(src, existing.content, existing.contentHtml, existing.fetchedAt, true);
  }

  // 2. On-demand fallback — fetch and persist so subsequent requests are fast
  try {
    const [surahStr, ayahStr] = verseKey.split(":");
    const surahNumber = parseInt(surahStr, 10);
    const ayahNumber  = parseInt(ayahStr, 10);

    if (isNaN(surahNumber) || isNaN(ayahNumber)) {
      throw new Error(`Invalid verse key: ${verseKey}`);
    }

    const fetcher = buildFetcher(src);
    const fetched = await fetcher.fetchVerse(surahNumber, ayahNumber);

    // Persist to DB asynchronously — don't block the response
    db.tafsirEntry.upsert({
      where:  { sourceId_verseKey: { sourceId: src.id, verseKey } },
      update: {
        content:     fetched.content,
        contentHtml: fetched.contentHtml ?? null,
        fetchedAt:   new Date(),
        isStale:     false,
      },
      create: {
        sourceId:    src.id,
        verseKey,
        content:     fetched.content,
        contentHtml: fetched.contentHtml ?? null,
      },
    }).catch((e) => console.error("[tafsir.service] Failed to persist on-demand entry:", e));

    return toResult(src, fetched.content, fetched.contentHtml, new Date(), false);
  } catch (err) {
    console.error(
      `[tafsir.service] On-demand fetch failed for ${verseKey} from "${src.slug}":`,
      err instanceof Error ? err.message : err
    );
    // Return a structured error so the UI can display a graceful message
    return toResult(src, "", undefined, new Date(), false, true);
  }
}

function buildFetcher(src: SourceRow): ITafsirSource {
  if (src.type === "api") {
    return new QuranApiTafsirSource(src.config as QuranApiSourceConfig);
  }
  if (src.type === "scrape") {
    return new TafsirAppSource(src.config as TafsirAppSourceConfig);
  }
  throw new Error(`Unknown source type: ${src.type}`);
}

function toResult(
  src: SourceRow,
  content: string,
  contentHtml: string | null | undefined,
  fetchedAt: Date,
  fromCache: boolean,
  failed = false
): TafsirEntryResult {
  const meta: TafsirSourceMeta = {
    slug:       src.slug,
    name:       src.name,
    nameArabic: src.nameArabic,
    language:   src.language,
    type:       src.type,
  };

  return {
    source:      meta,
    content:     failed ? "" : content,
    contentHtml: contentHtml ?? undefined,
    fetchedAt:   fetchedAt.toISOString(),
    fromCache,
    ...(failed && { error: "Content unavailable" }),
  } as TafsirEntryResult;
}

// ── Legacy compat: used by the old /api/tafsir/[verseKey] route ───────────

/** @deprecated Use getTafsirForVerse instead */
export async function getTafsir(verseKey: string, tafsirId = 169) {
  // Map old numeric IDs to source slugs
  const slugMap: Record<number, string> = {
    169: "ibn-kathir-en",
    91:  "ibn-kathir-ar",
  };
  const slug = slugMap[tafsirId] ?? "ibn-kathir-en";
  const res  = await getTafsirForVerse(verseKey, [slug]);
  const entry = res.entries[0];
  return {
    text:      entry?.content ?? "",
    verseKey,
    fromCache: entry?.fromCache ?? false,
  };
}
