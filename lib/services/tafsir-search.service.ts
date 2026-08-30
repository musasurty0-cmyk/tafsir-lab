/**
 * Tafsir retrieval — the part that makes citation possible and invention not.
 *
 * Every passage this returns is a row a human wrote, fetched from the corpus.
 * Nothing here generates prose, and the answer layer above is only allowed to
 * arrange what comes back from here. That is the whole architecture: the
 * assistant cannot claim al-Ṭabarī said something unless al-Ṭabarī's text is
 * sitting in the result set with its verse key attached.
 *
 * Two retrieval paths, deliberately both:
 *
 *   semantic — the question is embedded and matched against chunk vectors.
 *              Finds passages that are ABOUT the question even when they share
 *              no words with it, and works across languages: an English
 *              question can land on an Arabic passage because both live in one
 *              embedding space.
 *
 *   lexical  — trigram similarity on the raw text. Finds exact phrases and
 *              proper nouns ("Nawf al-Bikālī", "الصراط المستقيم"), which is
 *              precisely what semantic search is worst at and precisely what a
 *              citation-first assistant gets asked for.
 *
 * The chunk table stores SPANS, not text, so both queries slice the passage
 * back out of TafsirEntry. That keeps a second copy of the corpus out of the
 * database, and it means the text returned here is byte-for-byte what was
 * embedded — a quotation cannot drift from what the vector described.
 *
 * They are merged by reciprocal rank fusion rather than by comparing scores.
 * A cosine distance and a trigram similarity are not on the same scale, and
 * blending them numerically produces a ranking that looks principled and is
 * arbitrary. RRF only uses each list's ORDER, which is the part that means
 * something in both.
 */

import { db } from "@/lib/db";
import { probeTerms } from "@/lib/tafsir/answer";

export interface SearchHit {
  chunkId:    string;
  sourceSlug: string;
  sourceName: string;
  language:   string;
  verseKey:   string;
  surah:      number;
  ayah:       number;
  content:    string;
  /** Where it came from, so the trace can say so honestly. */
  via:        "semantic" | "lexical" | "both";
  rank:       number;
}

export interface SearchOptions {
  /** Restrict to these source slugs. Empty/undefined = every active source. */
  sources?:   string[];
  /** Restrict to one verse, e.g. "2:255". */
  verseKey?:  string;
  /** Restrict to one sūrah. */
  surah?:     number;
  limit?:     number;
}

const DEFAULT_LIMIT = 12;
/** Per-path candidate depth before fusion. */
const CANDIDATES = 30;
/**
 * RRF's smoothing constant. 60 is the value from the original paper and the
 * one every implementation uses; it flattens the difference between ranks 1
 * and 2 enough that a single path cannot dominate the fused list.
 */
const RRF_K = 60;

/** Rows the SQL below returns, before fusion. */
interface RawHit {
  chunkId: string; sourceSlug: string; sourceName: string; language: string;
  verseKey: string; surah: number; ayah: number; content: string;
}

function filterSql(opts: SearchOptions, params: unknown[]): string {
  const parts: string[] = [];
  if (opts.sources?.length) {
    params.push(opts.sources);
    parts.push(`s.slug = ANY($${params.length}::text[])`);
  }
  if (opts.verseKey) {
    params.push(opts.verseKey);
    parts.push(`c."verseKey" = $${params.length}`);
  }
  if (opts.surah) {
    params.push(opts.surah);
    parts.push(`c.surah = $${params.length}::int`);
  }
  return parts.length ? `AND ${parts.join(" AND ")}` : "";
}

/** Nearest chunks to a query vector. */
export async function semanticSearch(
  embedding: number[], opts: SearchOptions = {},
): Promise<RawHit[]> {
  // pgvector takes the literal as text and casts; building it here rather than
  // passing an array avoids a driver that would send it as a Postgres array.
  const literal = `[${embedding.map((x) => x.toFixed(6)).join(",")}]`;
  const params: unknown[] = [literal];
  const where = filterSql(opts, params);
  params.push(opts.limit ?? CANDIDATES);

  return db.$queryRawUnsafe<RawHit[]>(`
    SELECT c.id         AS "chunkId",
           s.slug       AS "sourceSlug",
           s.name       AS "sourceName",
           s.language   AS "language",
           c."verseKey" AS "verseKey",
           c.surah, c.ayah,
           substr(e.content, c."startChar" + 1, c."endChar" - c."startChar") AS content
    FROM "TafsirChunk" c
    JOIN "TafsirSource" s ON s.id = c."sourceId"
    JOIN "TafsirEntry"  e ON e."sourceId" = c."sourceId" AND e."verseKey" = c."verseKey"
    WHERE c.embedding IS NOT NULL ${where}
    ORDER BY c.embedding <=> $1::halfvec
    LIMIT $${params.length}::int
  `, ...params);
}

/**
 * Trigram search, over the ENTRY text.
 *
 * The chunk table holds spans rather than text, so there is nothing on it to
 * trigram-match. Matching the whole entry and then mapping back to the chunk
 * that contains the hit is not a workaround — it is better: trigram similarity
 * over a 1,200-char slice is noisier than over the whole passage, and one
 * index on TafsirEntry replaces one per chunk.
 *
 * Uses `<%` (word similarity), NOT `%` (string similarity). `%` compares two
 * strings as wholes, so a five-character query against an eight-thousand
 * character commentary scores near zero and matches nothing — which is what it
 * did, silently returning no lexical hits at all. `<%` asks the question that
 * was actually meant: is the query similar to some SUBSTRING of the document.
 * `<<->` is its distance counterpart, for ranking.
 *
 * Candidates are capped BEFORE they are ranked. Ordering by `<<->` across the
 * whole table computes a word distance for every row of every commentary —
 * tens of thousands of multi-kilobyte documents — which took long enough to
 * hang the request. Filtering first and ranking within a bounded candidate set
 * costs some ranking quality in the tail and makes the query bounded, which is
 * the right trade when this path exists as the exact-phrase fallback and the
 * semantic path is the primary ranker.
 *
 * DISTINCT ON keeps one chunk per entry — whichever span contains the match,
 * falling back to the first chunk when the match is fuzzy and `strpos` finds
 * no exact offset.
 */
export async function lexicalSearch(
  query: string, opts: SearchOptions = {},
): Promise<RawHit[]> {
  const q = query.trim();
  // Below three characters every trigram matches, which is a slow scan for a
  // useless result.
  if (q.length < 3) return [];

  /* Two filter sets, because the CTE and the outer query select from different
     tables. TafsirEntry has a verseKey and no surah column, so the surah and
     verse filters belong on the chunk side where those columns exist — pushing
     them into the CTE by string-replacing the alias would generate SQL
     referencing a column that does not exist. */
  const params: unknown[] = [q];

  const entryFilters: string[] = [];
  if (opts.sources?.length) {
    params.push(opts.sources);
    entryFilters.push(`s.slug = ANY($${params.length}::text[])`);
  }
  if (opts.verseKey) {
    params.push(opts.verseKey);
    entryFilters.push(`e."verseKey" = $${params.length}`);
  }
  if (opts.surah) {
    params.push(opts.surah);
    entryFilters.push(`split_part(e."verseKey", ':', 1)::int = $${params.length}::int`);
  }
  const entryWhere = entryFilters.length ? `AND ${entryFilters.join(" AND ")}` : "";

  params.push(opts.limit ?? CANDIDATES);

  /* Two settings, applied for this statement only.
     The threshold is counter-intuitive and was measured, not guessed: a HIGHER
     word_similarity_threshold returns MORE results and is faster. At the 0.6
     default a common word matches a large slice of a 78k-row corpus, the scan
     runs past the timeout and yields nothing; at 0.85 the same word answers in
     about two seconds. Loosening it to "find more" is what actually finds less.
     The timeout is the backstop: one slow probe contributes nothing and the
     others still answer, rather than hanging the whole question. */
  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.85`);
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '7s'`);
    return tx.$queryRawUnsafe<RawHit[]>(`
    WITH candidates AS (
      /* Deliberately NOT restricted to entries that have chunk rows.
         Chunks carry embeddings and name the span worth quoting — but an entry
         that has not been embedded yet is still an entry, and still the right
         answer to a keyword question. Requiring a chunk here meant that the
         moment the chunk table was empty the entire lexical path returned
         nothing, for every query, while reporting "no matches" as though the
         corpus simply had none: a total failure wearing the face of an
         ordinary empty result. */
      SELECT e."sourceId", e."verseKey", e.content
      FROM "TafsirEntry" e
      JOIN "TafsirSource" s ON s.id = e."sourceId"
      WHERE $1 <% e.content
        ${entryWhere}
      LIMIT 300
    ), matches AS (
      SELECT "sourceId", "verseKey", content,
             strpos(content, $1) AS hit_at
      FROM candidates
      ORDER BY $1 <<-> content
      LIMIT 60
    )
    SELECT DISTINCT ON (m."sourceId", m."verseKey")
           /* A real chunk id when one exists, otherwise a stable synthetic one:
              de-duplication and citation both key off this downstream, and two
              passages must never collide on it. */
           COALESCE(c.id::text, m."sourceId"::text || '#' || m."verseKey") AS "chunkId",
           s.slug       AS "sourceSlug",
           s.name       AS "sourceName",
           s.language   AS "language",
           m."verseKey" AS "verseKey",
           split_part(m."verseKey", ':', 1)::int AS surah,
           split_part(m."verseKey", ':', 2)::int AS ayah,
           COALESCE(
             substr(m.content, c."startChar" + 1, c."endChar" - c."startChar"),
             /* No chunk to name a span, so quote a window around the hit. Not
                the whole entry: commentary runs to thousands of characters and
                one such passage would crowd every other source out of the
                model's context. */
             substr(m.content, GREATEST(1, m.hit_at - 200), 1400)
           ) AS content
    FROM matches m
    LEFT JOIN "TafsirChunk" c
      ON  c."sourceId" = m."sourceId"
      AND c."verseKey" = m."verseKey"
      AND (m.hit_at = 0 OR m.hit_at BETWEEN c."startChar" + 1 AND c."endChar")
    JOIN "TafsirSource" s ON s.id = m."sourceId"
    ORDER BY m."sourceId", m."verseKey",
             -- prefer a real chunk span; fall back to the computed window
             (c.id IS NOT NULL) DESC,
             c."chunkIndex" ASC NULLS LAST
    LIMIT $${params.length}::int
    `, ...params);
  }).catch(() => [] as RawHit[]);   // a timed-out probe contributes nothing

  return rows;
}

/**
 * Every commentary on one verse, regardless of what words the question used.
 *
 * When a reader names a verse, that verse's commentary IS the answer — the
 * keyword search should not have to agree. "What does 18:65 say?" returned
 * nothing at all, because the question's only content words are the digits in
 * the reference, so no trigram matched, while Ibn Kathir alone had 27,000
 * characters on that ayah waiting behind the filter.
 *
 * Longest first, as a rough proxy for which commentary says most about it.
 */
async function verseEntries(verseKey: string, opts: SearchOptions): Promise<RawHit[]> {
  const params: unknown[] = [verseKey];
  let sourceFilter = "";
  if (opts.sources?.length) {
    params.push(opts.sources);
    sourceFilter = `AND s.slug = ANY($${params.length}::text[])`;
  }
  params.push(opts.limit ?? DEFAULT_LIMIT);

  return db.$queryRawUnsafe<RawHit[]>(`
    SELECT e."sourceId"::text || '#' || e."verseKey"        AS "chunkId",
           s.slug     AS "sourceSlug",
           s.name     AS "sourceName",
           s.language AS "language",
           e."verseKey",
           split_part(e."verseKey", ':', 1)::int AS surah,
           split_part(e."verseKey", ':', 2)::int AS ayah,
           substr(e.content, 1, 1400)            AS content
    FROM "TafsirEntry" e
    JOIN "TafsirSource" s ON s.id = e."sourceId"
    WHERE e."verseKey" = $1
      AND length(e.content) >= 120
      ${sourceFilter}
    ORDER BY length(e.content) DESC
    LIMIT $${params.length}::int
  `, ...params);
}

/**
 * Merge two ranked lists by reciprocal rank fusion.
 *
 * Exported because it is pure and worth testing on its own: it decides what the
 * assistant quotes, and a fusion bug would show up as "the answers are a bit
 * off" rather than as an error.
 */
export function fuse(
  semantic: RawHit[], lexical: RawHit[], limit: number,
): SearchHit[] {
  const score = new Map<string, number>();
  const seen  = new Map<string, RawHit>();
  const from  = new Map<string, Set<"semantic" | "lexical">>();

  const add = (rows: RawHit[], via: "semantic" | "lexical") => {
    rows.forEach((row, i) => {
      const k = row.chunkId;
      score.set(k, (score.get(k) ?? 0) + 1 / (RRF_K + i + 1));
      if (!seen.has(k)) seen.set(k, row);
      if (!from.has(k)) from.set(k, new Set());
      from.get(k)!.add(via);
    });
  };

  add(semantic, "semantic");
  add(lexical, "lexical");

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([chunkId], i) => {
      const row  = seen.get(chunkId)!;
      const vias = from.get(chunkId)!;
      return {
        ...row,
        via: vias.size === 2 ? "both" : [...vias][0],
        rank: i + 1,
      };
    });
}

export interface SearchResult {
  hits: SearchHit[];
  /** What actually happened, for the visible trace. Never decorative. */
  trace: {
    semanticUsed: boolean;
    semanticCount: number;
    lexicalCount: number;
    /** Set when the embedding service was unreachable and we fell back. */
    degraded?: string;
    sourcesSearched: string[];
  };
}

/**
 * The retrieval the assistant runs.
 *
 * `embedding` may be null — the Space sleeps on the free tier and can be slow
 * to wake. When it is null this still answers, from lexical search alone, and
 * says so in the trace. A degraded answer that admits it is degraded is worth
 * more than an error, and far more than a confident answer built on nothing.
 */
export async function search(
  query: string, embedding: number[] | null, opts: SearchOptions = {},
): Promise<SearchResult> {
  const limit = opts.limit ?? DEFAULT_LIMIT;

  /* Lexical search gets CONTENT WORDS, not the sentence.
     `<%` measures similarity between the query and a substring of the
     document, so a forty-character question resembles nothing and returns
     empty — which is what "Who was al-Khidr and what did Musa learn?" did.
     Searching the two or three strongest words instead is what a person would
     do, and it is the difference between the keyword fallback working and not.
     probeTerms ranks subject words above the vocabulary of asking — otherwise
     "What do the commentators say about al-hamd?" searched for "commentators".
     Two probes rather than three — they run in parallel but contend for the
     same index, and the third rarely changes the top of the list. */
  const probes = probeTerms(query).slice(0, 2);
  const lexicalQueries = probes.length ? probes : [query];

  const [direct, semantic, ...lexicalLists] = await Promise.all([
    /* A named verse answers itself. Fetched alongside the other two rather
       than instead of them, so a question that is both specific and about a
       theme still benefits from the keyword and semantic lists. */
    opts.verseKey ? verseEntries(opts.verseKey, opts) : Promise.resolve([] as RawHit[]),
    embedding ? semanticSearch(embedding, { ...opts, limit: CANDIDATES }) : Promise.resolve([]),
    ...lexicalQueries.map((p) => lexicalSearch(p, { ...opts, limit: CANDIDATES })),
  ]);

  // Each probe is its own ranked list, fused like any other — a passage found
  // by two of them should outrank one found by a single word.
  const lexical = lexicalLists.length > 1
    ? fuse(lexicalLists[0], lexicalLists.slice(1).flat(), CANDIDATES)
    : (lexicalLists[0] ?? []);

  /* The verse's own commentary is fused in first, so it leads when a verse was
     named and simply adds nothing when one was not. */
  const found = fuse(semantic, lexical, limit);
  const hits = direct.length ? fuse(direct, found, limit) : found;

  return {
    hits,
    trace: {
      semanticUsed:  embedding !== null,
      semanticCount: semantic.length,
      lexicalCount:  lexical.length,
      degraded: embedding === null
        ? "The embedding service did not respond, so this used keyword search only."
        : undefined,
      sourcesSearched: [...new Set(hits.map((h) => h.sourceName))],
    },
  };
}

/** Every source that actually has embedded content, for the source picker. */
export async function availableSources() {
  const rows = await db.$queryRawUnsafe<{
    slug: string; name: string; language: string; chunks: bigint; verses: bigint;
  }[]>(`
    SELECT s.slug, s.name, s.language,
           count(*)                    AS chunks,
           count(DISTINCT c."verseKey") AS verses
    FROM "TafsirChunk" c
    JOIN "TafsirSource" s ON s.id = c."sourceId"
    GROUP BY s.slug, s.name, s.language
    ORDER BY count(DISTINCT c."verseKey") DESC
  `);
  // bigint from count() does not survive JSON.
  return rows.map((r) => ({
    ...r, chunks: Number(r.chunks), verses: Number(r.verses),
  }));
}

// ── The reader's own notes ─────────────────────────────────────────────────

/**
 * Search the notes this user has written.
 *
 * Kept separate from tafsir retrieval rather than merged into it, because the
 * two are not the same kind of evidence. A passage from al-Qurtubi is a claim
 * about the text; a note is the reader's own thinking, which may be a question,
 * a half-formed idea, or simply wrong. Labelling a note as "Your note" and
 * never as a source means the assistant can quote it back without it acquiring
 * the authority of a commentary.
 *
 * Lexical only. Note bodies are TipTap JSON, so there is no embedding column
 * to search, and trigram over the extracted text is both adequate and cheap at
 * the scale one person writes.
 */
export interface NoteHit {
  noteId:   string;
  title:    string;      // where it was written, for the citation
  verseKey: string | null;
  content:  string;
  workspace: string;
}

/** TipTap JSON to plain text, for matching and for quoting back. */
function noteText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  const inner = (n.content ?? []).map(noteText).join("");
  return n.type === "paragraph" || n.type === "heading" ? inner + "\n" : inner;
}

export async function searchNotes(
  userId: string, query: string,
  opts: { surah?: number; verseKey?: string; pageId?: string; limit?: number } = {},
): Promise<NoteHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  /* Pulled and filtered in JS rather than in SQL. The searchable text lives
     inside a JSON column, so Postgres cannot trigram-match it without a
     generated column; one person's notes are in the hundreds, not millions, so
     reading them is cheaper than the migration would be. */
  const rows = await db.structuredNote.findMany({
    where: {
      authorId: userId,
      ...(opts.pageId  ? { pageId: opts.pageId } : {}),
      ...(opts.verseKey
        ? { surahNumber: Number(opts.verseKey.split(":")[0]),
            ayahNumber:  Number(opts.verseKey.split(":")[1]) }
        : opts.surah ? { surahNumber: opts.surah } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 400,
    select: {
      id: true, content: true, surahNumber: true, ayahNumber: true,
      page: { select: { title: true, workspaceSurah: { select: { workspace: { select: { name: true } } } } } },
    },
  });

  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored: (NoteHit & { score: number })[] = [];

  for (const r of rows) {
    const text = noteText(r.content).replace(/\n{2,}/g, "\n").trim();
    if (text.length < 10) continue;
    const hay = text.toLowerCase();
    const score = terms.reduce((a, t) => a + (hay.includes(t) ? 1 : 0), 0);
    if (score === 0) continue;
    scored.push({
      noteId: r.id,
      title: r.page?.title ?? "Note",
      verseKey: r.surahNumber != null && r.ayahNumber != null
        ? `${r.surahNumber}:${r.ayahNumber}` : null,
      content: text.slice(0, 1200),
      workspace: r.page?.workspaceSurah?.workspace?.name ?? "",
      score,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 4)
    .map(({ score: _score, ...n }) => n);
}
