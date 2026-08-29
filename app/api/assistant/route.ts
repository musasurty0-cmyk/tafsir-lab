/**
 * POST /api/assistant — ask the corpus a question.
 *
 * Streams newline-delimited JSON events so the client can show the work as it
 * happens rather than after it. The trace is not decoration: every step it
 * reports is a step that actually ran, and the sources it names are the sources
 * the answer was built from. If the trace and the answer could ever disagree,
 * the trace would be theatre — so both are produced from the same objects.
 *
 * Events, in order:
 *   { step }      a stage started or finished
 *   { sources }   what was searched, and what came back
 *   { answer }    the selected sentences, each with its citation
 *   { passages }  the full retrieved passages, with translations
 *   { done }      totals, and any honest caveat
 *
 * The totals in `done` are named passageCount, not `passages` — a count and
 * the array of passages sharing one key let the number overwrite the array in
 * the client, which silently emptied the passages panel.
 *   { error }     something failed
 *
 * NOTHING here generates prose. The answer is assembled from sentences that
 * appear verbatim in retrieved passages, and `verifyExtractive` re-checks that
 * before the response is sent. The only model output anywhere in the pipeline
 * is machine translation of Arabic that already exists.
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import * as Search from "@/lib/services/tafsir-search.service";
import * as Models from "@/lib/tafsir/model-client";
import { selectSentences, verifyExtractive, type Passage } from "@/lib/tafsir/answer";
import { parseReference } from "@/lib/quran-search";

export const runtime = "nodejs";
/** Retrieval plus a cold Space can take a while; the default would cut it off. */
export const maxDuration = 60;

const MAX_QUESTION = 500;
/** Passages translated per answer. Each is a Space round trip. */
const TRANSLATE_LIMIT = 3;

export async function POST(req: NextRequest) {
  try {
    await getSession();
  } catch {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as {
    question?: unknown; sources?: unknown; verseKey?: unknown;
  };

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 3) {
    return new Response(JSON.stringify({ error: "Ask a longer question." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const sources = Array.isArray(body.sources)
    ? body.sources.filter((s): s is string => typeof s === "string").slice(0, 20)
    : undefined;

  const q = question.slice(0, MAX_QUESTION);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      try {
        // ── 1. Read the question ─────────────────────────────────────────
        // A reference in the question is a hard filter, not a hint: someone who
        // types 2:255 wants that verse, not passages that resemble it.
        const ref = parseReference(q);
        const verseKey = typeof body.verseKey === "string" ? body.verseKey
          : ref?.ayah != null ? `${ref.surah}:${ref.ayah}` : undefined;
        const surah = !verseKey && ref ? ref.surah : undefined;

        send({
          step: "understand",
          detail: verseKey ? `Reading as a question about ${verseKey}`
            : surah ? `Reading as a question about sūrah ${surah}`
            : "Reading the question",
          ...(sources?.length ? { pinned: sources } : {}),
        });

        // ── 2. Embed ─────────────────────────────────────────────────────
        send({ step: "embed", detail: "Placing the question in the corpus's meaning-space" });
        const embedding = Models.isConfigured() ? await Models.embed(q) : null;
        if (!embedding) {
          send({
            step: "embed", state: "degraded",
            detail: Models.isConfigured()
              ? "The embedding service did not answer — falling back to keyword search"
              : "No embedding service configured — using keyword search",
          });
        }

        // ── 3. Retrieve ──────────────────────────────────────────────────
        send({ step: "search", detail: "Searching the tafsīr corpus" });
        const { hits, trace } = await Search.search(q, embedding, {
          sources, verseKey, surah, limit: 12,
        });

        send({
          sources: {
            searched: trace.sourcesSearched,
            semantic: trace.semanticCount,
            lexical:  trace.lexicalCount,
            hits: hits.map((h) => ({
              sourceName: h.sourceName, sourceSlug: h.sourceSlug,
              verseKey: h.verseKey, via: h.via, rank: h.rank,
              language: h.language,
            })),
          },
        });

        if (hits.length === 0) {
          send({
            step: "answer", state: "empty",
            detail: "Nothing in the corpus matched that.",
          });
          send({
            done: true, quoted: 0, passageCount: 0,
            note: sources?.length
              ? "Nothing found in the sources you pinned. Try removing the filter, or asking about a specific verse."
              : "No passage matched. The corpus only covers the editions that have been ingested — it cannot answer from outside them, and will not guess.",
          });
          return;   // `finally` closes the controller; closing twice throws
        }

        // ── 4. Select, and verify the selection is real ───────────────────
        send({ step: "select", detail: `Choosing what to quote from ${hits.length} passages` });

        const passages: Passage[] = hits.map((h) => ({
          sourceSlug: h.sourceSlug, sourceName: h.sourceName,
          language: h.language, verseKey: h.verseKey, content: h.content,
        }));

        const selected = selectSentences(q, passages, { max: 6, perSource: 2 });

        /* The guarantee, executed. If selection ever emits something that is
           not in the corpus, refuse to answer rather than ship a citation that
           is not true. This has never fired in testing; it exists so that if it
           ever does, it fails loudly instead of quietly. */
        const check = verifyExtractive(selected, passages);
        if (!check.ok) {
          send({
            error: "An internal check failed: a sentence did not match its source, " +
                   "so the answer was withheld rather than shown with a citation " +
                   "that might be wrong.",
            offending: check.offending,
          });
          return;   // `finally` closes the controller; closing twice throws
        }

        send({
          answer: {
            sentences: selected.map((s) => ({
              text: s.text, sourceName: s.sourceName,
              sourceSlug: s.sourceSlug, verseKey: s.verseKey,
            })),
            extractive: true,
          },
        });

        // ── 5. Translate the Arabic that is being shown ───────────────────
        const arabic = hits.filter((h) => h.language === "ar").slice(0, TRANSLATE_LIMIT);
        if (arabic.length && Models.isConfigured()) {
          send({ step: "translate", detail: `Translating ${arabic.length} Arabic passage(s)` });
        }

        const translations = new Map<string, string>();
        for (const h of arabic) {
          if (!Models.isConfigured()) break;
          const t = await Models.translate(h.content);
          if (t) translations.set(h.chunkId, t);
        }

        send({
          passages: hits.map((h) => ({
            chunkId: h.chunkId,
            sourceName: h.sourceName, sourceSlug: h.sourceSlug,
            language: h.language, verseKey: h.verseKey,
            content: h.content,
            translation: translations.get(h.chunkId) ?? null,
            via: h.via, rank: h.rank,
          })),
        });

        send({
          done: true,
          quoted: selected.length,
          passageCount: hits.length,
          note: trace.degraded,
        });
      } catch (err) {
        send({
          error: "Something went wrong answering that.",
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        // Defensive: a stream the client abandoned is already closed, and
        // throwing here would surface as "failed to pipe response" for a
        // request that had in fact completed.
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Nginx and some proxies buffer streamed responses, which would collapse
      // the whole point of showing the work as it happens.
      "X-Accel-Buffering": "no",
    },
  });
}
