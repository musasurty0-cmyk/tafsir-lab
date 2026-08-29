/**
 * ingest-corpus — pull the ten tafāsīr chosen for the assistant's corpus.
 *
 * Sequential on purpose. These are static files on a public CDN, so the limit
 * is politeness rather than quota: one edition at a time, a short pause between
 * surahs, and a resumable design — every surah already present is skipped, so
 * re-running after an interruption costs a few hundred cheap queries rather
 * than the whole run again.
 *
 *   node scripts/ingest-corpus.mjs            # everything below
 *   node scripts/ingest-corpus.mjs --only ar  # Arabic editions only
 */

import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

/** The ten works, plus the English editions that exist for four of them. */
const EDITIONS = [
  // ── Arabic ──────────────────────────────────────────────────────────────
  ["ar-tafsir-ibn-kathir",      "ar", "Ibn Kathīr"],
  ["ar-tafsir-al-tabari",       "ar", "al-Ṭabarī"],
  ["ar-tafseer-al-qurtubi",     "ar", "al-Qurṭubī"],
  ["ar-tafsir-al-jalalayn",     "ar", "al-Jalālayn"],
  ["ar-tafsir-as-saadi",        "ar", "al-Saʿdī"],
  ["ar-tafsir-al-mukhtasar",    "ar", "al-Mukhtaṣar"],
  ["tafsir-al-razi",            "ar", "al-Rāzī — Mafātīḥ al-Ghayb"],
  ["nazam-al-durar-al-biqa-i",  "ar", "al-Biqāʿī — Naẓm al-Durar"],
  ["ar-tafsir-al-baghawi",      "ar", "al-Baghawī"],
  ["tafsir-al-baydawi",         "ar", "al-Bayḍāwī"],
  // ── English, where the same work has one ────────────────────────────────
  ["en-tafisr-ibn-kathir",      "en", "Ibn Kathīr (English)"],
  ["en-al-jalalayn",            "en", "al-Jalālayn (English)"],
  ["en-tafsir-al-mukhtasar",    "en", "al-Mukhtaṣar (English)"],
  ["tafsir-al-jalalayn",        "en", "al-Jalālayn — Feras Hamza (English)"],
];

const LOG = "tafsir-ingest.log";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

function say(line) {
  const stamped = `${new Date().toISOString().slice(11, 19)}  ${line}`;
  console.log(stamped);
  try { appendFileSync(LOG, stamped + "\n"); } catch { /* logging is best effort */ }
}

function run(slug) {
  return new Promise((resolve) => {
    const p = spawn("npx", ["tsx", "scripts/ingest-tafsir.ts", "--source", slug, "--all"], {
      shell: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let inserted = 0, errors = 0;
    const scan = (buf) => {
      const t = String(buf);
      // The per-surah summary lines are the only ones worth keeping; the
      // per-verse chatter would bury them.
      for (const m of t.matchAll(/Done: (\d+) inserted, \d+ skipped, (\d+) errors/g)) {
        inserted += Number(m[1]); errors += Number(m[2]);
      }
    };
    p.stdout.on("data", scan);
    p.stderr.on("data", scan);
    p.on("close", (code) => resolve({ code, inserted, errors }));
  });
}

const wanted = EDITIONS.filter(([, lang]) => !only || lang === only);
say(`corpus ingest: ${wanted.length} editions × 114 surahs`);

let grandTotal = 0;
for (const [slug, lang, name] of wanted) {
  say(`▶ ${name}  [${lang}]  ${slug}`);
  const t0 = Date.now();
  const { code, inserted, errors } = await run(slug);
  grandTotal += inserted;
  say(`  ${inserted} verses, ${errors} errors, ${((Date.now() - t0) / 1000).toFixed(0)}s` +
      (code === 0 ? "" : `  (exit ${code})`));
}

say(`corpus ingest finished — ${grandTotal} verses across ${wanted.length} editions`);
