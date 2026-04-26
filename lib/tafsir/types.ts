/**
 * Shared types for the tafsir ingestion layer.
 *
 * The architecture separates concerns into three layers:
 *   1. Source interface  — how to fetch one verse from one provider
 *   2. Orchestrator     — manages TafsirFetchJob lifecycle, bulk ingestion
 *   3. Service          — reads TafsirEntry rows and returns them to the API
 */

// ── Source interface ──────────────────────────────────────────────────────

/**
 * A single fetched tafsir entry for one verse.
 */
export interface FetchedEntry {
  /** "1:1" format */
  verseKey: string;
  /** Plain-text content with HTML stripped — always present */
  content: string;
  /** Raw HTML as returned by the source — optional, may have <em> / footnotes */
  contentHtml?: string;
}

/**
 * Every source adapter implements this interface.
 * Sources are stateless — all config is injected at construction time.
 */
export interface ITafsirSource {
  /**
   * Fetch tafsir for a single verse.
   * Throws if the source is unreachable or the verse is not found.
   */
  fetchVerse(surahNumber: number, ayahNumber: number): Promise<FetchedEntry>;
}

// ── Source config shapes (stored in TafsirSource.config JSON column) ──────

export interface QuranApiSourceConfig {
  provider: "quran.com";
  /** Numeric ID from api.quran.com/api/v4/tafsirs */
  tafsirId: number;
}

export interface TafsirAppSourceConfig {
  provider: "tafsir.app";
  /** URL slug, e.g. "tabari", "muyassar", "saadi" */
  slug: string;
}

export type SourceConfig = QuranApiSourceConfig | TafsirAppSourceConfig;

// ── Ingestion result ──────────────────────────────────────────────────────

export interface IngestResult {
  sourceSlug: string;
  surahNumber: number;
  inserted: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

// ── Unified API response shape ────────────────────────────────────────────

export interface TafsirSourceMeta {
  slug:       string;
  name:       string;
  nameArabic: string | null;
  language:   string;
  type:       string;
}

export interface TafsirEntryResult {
  source:     TafsirSourceMeta;
  content:    string;
  contentHtml?: string;
  fetchedAt:  string;   // ISO timestamp
  fromCache:  boolean;  // false = freshly fetched on this request
}

export interface UnifiedTafsirResponse {
  verseKey: string;
  entries:  TafsirEntryResult[];
}
