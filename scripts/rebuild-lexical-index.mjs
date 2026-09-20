/**
 * Rebuild the tafsīr trigram index as a PARTIAL index over the editions listed
 * in lib/tafsir/lexical-sources.ts.
 *
 *     node --env-file=.env scripts/rebuild-lexical-index.mjs
 *
 * Why this exists: a GIN trigram index over every edition's full text costs
 * 152 MB, and the database is on a 500 MB tier that was 95.7% full. Covering
 * the seven editions that matter for the lexical fallback costs about a third
 * of that. Semantic search is unaffected — it reads TafsirChunk embeddings and
 * still covers everything.
 *
 * ORDER MATTERS. The old index is dropped BEFORE the new one is built, because
 * there is not enough free space to hold both. Between the two statements the
 * fallback search has no index; that is a maintenance window, not a failure.
 * If the CREATE fails, rerun — the DROP is idempotent.
 */
import { PrismaClient } from "@prisma/client";

const SLUGS = [
  "ar-tafsir-al-tabari", "ar-tafsir-as-saadi", "en-tafisr-ibn-kathir",
  "ar-tafsir-al-jalalayn", "tafsir-al-jalalayn",
  "ar-tafsir-al-mukhtasar", "en-tafsir-al-mukhtasar",
];

const db = new PrismaClient();
const mb = (b) => (Number(b) / 1048576).toFixed(1) + " MB";
const size = async () => {
  const [r] = await db.$queryRawUnsafe(
    `SELECT pg_database_size(current_database()) AS db,
            COALESCE((SELECT pg_relation_size('tafsir_entry_trgm_idx'::regclass)), 0) AS idx`);
  return r;
};

try {
  const sources = await db.tafsirSource.findMany({
    where: { slug: { in: SLUGS } }, select: { id: true, slug: true },
  });
  const missing = SLUGS.filter((s) => !sources.some((r) => r.slug === s));
  if (missing.length) throw new Error("unknown slug(s): " + missing.join(", "));
  console.log("covering", sources.length, "editions:", sources.map((s) => s.slug).join(", "));

  let before;
  try { before = await size(); } catch { before = { db: 0n, idx: 0n }; }
  console.log("before — database", mb(before.db), "| trigram index", mb(before.idx));

  // Generous, because building a GIN index over ~67 MB of text is not quick.
  await db.$executeRawUnsafe(`SET statement_timeout = '30min'`);

  console.log("dropping the old index (frees the space the new one needs) …");
  await db.$executeRawUnsafe(`DROP INDEX IF EXISTS tafsir_entry_trgm_idx`);

  const list = sources.map((s) => `'${s.id}'::uuid`).join(", ");
  console.log("building the partial index …");
  await db.$executeRawUnsafe(
    `CREATE INDEX tafsir_entry_trgm_idx ON "TafsirEntry" USING gin (content gin_trgm_ops)
     WHERE "sourceId" IN (${list})`);

  const after = await size();
  console.log("after  — database", mb(after.db), "| trigram index", mb(after.idx));
  console.log("freed:", mb(Number(before.db) - Number(after.db)),
    "| now", ((Number(after.db) / (500 * 1048576)) * 100).toFixed(1) + "% of a 500 MB tier");
} catch (e) {
  console.error("FAILED:", e.message.split("\n")[0].slice(0, 300));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
