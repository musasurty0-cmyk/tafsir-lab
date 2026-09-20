/**
 * Which editions the fuzzy lexical fallback can search.
 *
 * SEMANTIC SEARCH COVERS EVERYTHING. This list is only about the trigram
 * index, which is the single most expensive object in the database: a GIN
 * index over every tafsīr's full text costs 152 MB, and the free tier is
 * 500 MB. At 95.7% full there was no room left for readers' own notes.
 *
 * So the index is now partial — it covers these seven editions (~67 MB of
 * text) instead of all seventeen (~180 MB), which is about 95 MB back.
 *
 * The seven are chosen to keep the fallback useful in both languages rather
 * than to keep the biggest: the foundational Arabic commentary (Ṭabarī), a
 * concise modern Arabic one (as-Saʿdī), the main English one (Ibn Kathīr),
 * and both Jalālayn and both Mukhtaṣar, which are short enough to index for
 * almost nothing and are the summaries people quote most.
 *
 * THIS LIST AND THE INDEX MUST AGREE. A partial index is only used when the
 * planner can prove the rows sought satisfy its predicate, so `lexicalSearch`
 * filters on exactly these sources — if it did not, Postgres would ignore the
 * index and sequentially scan 74k rows of TOASTed text into the 7s timeout.
 * After changing this list, rebuild with:
 *
 *     node --env-file=.env scripts/rebuild-lexical-index.mjs
 */
export const LEXICAL_SOURCE_SLUGS = [
  "ar-tafsir-al-tabari",      // 20.4 MB — the foundation
  "ar-tafsir-as-saadi",       // 17.1 MB — concise, modern, widely read
  "en-tafisr-ibn-kathir",     // 21.1 MB — the main English commentary
  "ar-tafsir-al-jalalayn",    //  2.5 MB
  "tafsir-al-jalalayn",       //  2.2 MB — the English Jalālayn
  "ar-tafsir-al-mukhtasar",   //  1.8 MB
  "en-tafsir-al-mukhtasar",   //  1.7 MB
] as const;
