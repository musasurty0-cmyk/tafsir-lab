"use client";

/**
 * The glyph codes for one āyah, fetched once per verse per session.
 *
 * A document can hold a dozen āyah blocks, several of them the same verse, and
 * each one mounting its own request for the same words would be a dozen round
 * trips for one answer. The promise is cached rather than the result, so blocks
 * that mount in the same tick share the request in flight instead of racing to
 * start identical ones.
 *
 * Verses of the sūrah already open come from the preloaded list with no request
 * at all — that is the common case, since most āyah blocks name a verse from
 * the sūrah being studied.
 */


export interface GlyphWord {
  /** code_v2 — private-use codepoints, meaningless outside their page font. */
  code: string;
  /** v2_page — which of the 604 faces draws them. */
  page: number;
}

/* Narrowed per item rather than declared as a shape. The editor's preloaded
   verses and the muṣḥaf's carry different word types, and an all-optional
   interface makes TypeScript reject the one with no properties in common —
   so the check happens on the values, where it actually matters. */
function glyphOf(w: unknown): GlyphWord | null {
  if (!w || typeof w !== "object") return null;
  const { code_v2: code, v2_page: page } = w as { code_v2?: unknown; v2_page?: unknown };
  if (typeof code !== "string" || !code) return null;
  if (typeof page !== "number" || !Number.isFinite(page)) return null;
  return { code, page };
}

const cache = new Map<string, Promise<GlyphWord[]>>();

function fromWords(words: readonly unknown[] | undefined): GlyphWord[] {
  if (!words?.length) return [];
  const out: GlyphWord[] = [];
  for (const w of words) {
    /* Both or neither. A code with no page cannot be drawn, and dropping it
       silently is better than rendering it in whatever font happens to win. */
    const g = glyphOf(w);
    if (g) out.push(g);
  }
  /* All or nothing: a half-rendered verse — some words in the muṣḥaf face and
     some missing — is worse than the plain text it would have shown. */
  return out.length === words.length ? out : [];
}

/**
 * Only what this needs, so both the muṣḥaf's verses (which carry glyph codes)
 * and the editor's preloaded ones (which do not) can be passed without a cast.
 * The latter simply miss the shortcut and fall through to the request.
 */
export interface MaybeGlyphVerse {
  verse_key: string;
  words?: readonly unknown[];
}

export function qcfWords(
  verseKey: string,
  preloaded: readonly MaybeGlyphVerse[] = [],
): Promise<GlyphWord[]> {
  const hit = preloaded.find((v) => v.verse_key === verseKey);
  if (hit) {
    const words = fromWords(hit.words);
    if (words.length) return Promise.resolve(words);
  }

  const existing = cache.get(verseKey);
  if (existing) return existing;

  const req = fetch(`/api/ayah/${verseKey.replace(":", "_")}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
    .then(({ verse }) => fromWords(verse?.words as readonly unknown[] | undefined))
    .catch(() => {
      /* Let a later mount try again rather than caching a failure for the
         session — this is usually a dropped connection, not a missing verse. */
      cache.delete(verseKey);
      return [] as GlyphWord[];
    });

  cache.set(verseKey, req);
  return req;
}
