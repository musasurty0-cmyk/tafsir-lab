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
 * A model DOES write the prose, and is only ever shown passages retrieved from
 * this corpus plus the conversation so far. It is never asked what it knows.
 * Citations are checked after generation: a [n] that does not resolve to a
 * supplied passage is reported rather than displayed as fact.
 *
 * With no model configured the route falls back to extractive selection —
 * sentences quoted verbatim, `verifyExtractive` enforcing it. That answers
 * without a provider, and says which mode it used.
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import * as Search from "@/lib/services/tafsir-search.service";
import * as Models from "@/lib/tafsir/model-client";
import { selectSentences, verifyExtractive, type Passage } from "@/lib/tafsir/answer";
import * as LLM from "@/lib/tafsir/llm";
import { parseReference, findReference } from "@/lib/quran-search";

export const runtime = "nodejs";
/** Retrieval plus a cold Space can take a while; the default would cut it off. */
export const maxDuration = 60;

const MAX_QUESTION = 500;
/** Passages translated per answer. Each is a Space round trip. */
const TRANSLATE_LIMIT = 3;

/* What reaches the MODEL is bounded; what reaches the reader is not.

   Groq's free tier allows 8,000 tokens a minute, and a dozen passages of
   commentary is comfortably 6,000 of them — so the second question asked
   inside a minute came back 429 and silently dropped to quoting. Fewer,
   tighter passages also produce better answers: the model is weighing six
   things rather than skimming twelve.

   Notes keep a reserved share, so a full slate of tafsīr hits cannot crowd
   out the reader's own writing on their own page. */
const LLM_MAX_PASSAGES  = 6;
const LLM_NOTE_SLOTS    = 2;
const LLM_MAX_CHARS_EACH = 900;

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await getSession());
  } catch {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as {
    question?: unknown; sources?: unknown; verseKey?: unknown; history?: unknown;
    surah?: unknown; pageId?: unknown; includeNotes?: unknown; selection?: unknown;
  };

  /* Prior turns, so a follow-up ("what about the second view?") has something
     to refer to. Trimmed and capped here rather than trusted: this arrives
     from the client and lands in a model prompt. */
  const history: LLM.ChatTurn[] = Array.isArray(body.history)
    ? (body.history as unknown[])
        .filter((t): t is { role: string; content: string } =>
          !!t && typeof t === "object" &&
          typeof (t as { content?: unknown }).content === "string")
        .slice(-8)
        .map((t) => ({
          role: t.role === "assistant" ? "assistant" as const : "user" as const,
          content: t.content.slice(0, 2000),
        }))
    : [];

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
        // parseReference wants the WHOLE string to be a reference; findReference
        // pulls one out of a sentence. A question is a sentence, so try both.
        const ref = parseReference(q) ?? findReference(q);

        /* Page context scopes the search ONLY when the question is about the
           page. "What are the main themes here?" means this sūrah; "Who was
           al-Khidr?" does not, and filtering it to whatever happens to be open
           would return nothing and look like the corpus had no answer.
           A reference in the question always wins over both. */
        const DEICTIC = /(this|these|here|above|below|current|the page|this verse|this passage|my notes)/i;
        const aboutHere = DEICTIC.test(q);
        const ctxSurah = typeof body.surah === "number" ? body.surah : undefined;

        const verseKey = ref?.ayah != null ? `${ref.surah}:${ref.ayah}`
          : typeof body.verseKey === "string" ? body.verseKey
          : undefined;
        const surah = verseKey ? undefined
          : ref ? ref.surah
          : aboutHere ? ctxSurah
          : undefined;


        send({
          step: "understand",
          detail: verseKey ? `Reading as a question about ${verseKey}`
            : surah ? `Scoped to sūrah ${surah}, the one you have open`
            : "Reading as a general question — searching every source",
          ...(sources?.length ? { pinned: sources } : {}),
        });

        /* The reader's own notes, when the panel asks for them. Fetched
           alongside the tafsir rather than instead of it, and kept clearly
           labelled: a note is the reader's thinking, not a source, and it must
           not acquire a commentary's authority by sitting in the same list. */
        const wantNotes = body.includeNotes !== false;
        let notes: Awaited<ReturnType<typeof Search.searchNotes>> = [];
        if (wantNotes) {
          notes = await Search.searchNotes(userId, q, {
            surah, verseKey,
            pageId: typeof body.pageId === "string" ? body.pageId : undefined,
          }).catch(() => []);
          if (notes.length) {
            send({ step: "notes", detail: `Found ${notes.length} of your own notes on this` });
          }
        }

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

        // ── 4. Answer ────────────────────────────────────────────────────
        const passages: Passage[] = hits.map((h) => ({
          sourceSlug: h.sourceSlug, sourceName: h.sourceName,
          language: h.language, verseKey: h.verseKey, content: h.content,
        }));

        const mode = LLM.provider();

        if (mode === "none") {
          /* No model configured. Rather than fail, fall back to quoting: the
             sentences that best match, verbatim, with verifyExtractive
             enforcing that every one is really in the corpus. Worse prose,
             same facts, and the client is told which mode produced it. */
          send({ step: "answer", detail: "No model configured — quoting the closest passages" });

          const selected = selectSentences(q, passages, { max: 6, perSource: 2 });
          const check = verifyExtractive(selected, passages);
          if (!check.ok) {
            send({
              error: "An internal check failed: a sentence did not match its source, " +
                     "so the answer was withheld rather than shown with a citation " +
                     "that might be wrong.",
              offending: check.offending,
            });
            return;
          }
          send({
            answer: {
              mode: "extractive",
              sentences: selected.map((s) => ({
                text: s.text, sourceName: s.sourceName,
                sourceSlug: s.sourceSlug, verseKey: s.verseKey,
              })),
            },
          });
        } else {
          send({
            step: "answer",
            detail: mode === "space"
              ? "Reading the passages (self-hosted model — this takes a moment)"
              : `Reading the passages (${mode})`,
          });

          // Numbered so the model can cite them and the numbers mean something
          // to the reader, who sees the same list.
          const noteQuota   = Math.min(notes.length, LLM_NOTE_SLOTS);
          const chosenHits  = hits.slice(0, LLM_MAX_PASSAGES - noteQuota);
          const chosenNotes = notes.slice(0, noteQuota);

          const numbered: LLM.Passage[] = [
            ...chosenHits.map((h, i) => ({
              n: i + 1,
              sourceName: h.sourceName,
              verseKey: h.verseKey,
              language: h.language,
              content: h.content.slice(0, LLM_MAX_CHARS_EACH),
            })),
            ...chosenNotes.map((nt, i) => ({
              n: chosenHits.length + i + 1,
              // Named so neither the model nor the reader can mistake the
              // reader's own note for a scholar's view.
              sourceName: `Your note — ${nt.title}`,
              verseKey: nt.verseKey ?? "",
              language: "en",
              content: nt.content.slice(0, LLM_MAX_CHARS_EACH),
            })),
          ];

          send({ answerStart: { mode, cites: numbered.map((p) => ({ n: p.n, sourceName: p.sourceName, verseKey: p.verseKey })) } });

          let full = "";
          try {
            for await (const piece of LLM.answer(q, numbered, history)) {
              full += piece;
              send({ token: piece });
            }
          } catch (err) {
            /* Generation failed mid-stream. Fall back to quoting rather than
               leaving a half-written answer on screen — a truncated paraphrase
               is the least trustworthy thing this app could show. */
            send({
              step: "answer", state: "degraded",
              detail: "The model did not answer — quoting the passages instead",
              reason: err instanceof Error ? err.message : String(err),
            });
            const selected = selectSentences(q, passages, { max: 6, perSource: 2 });
            if (verifyExtractive(selected, passages).ok) {
              send({
                answer: {
                  mode: "extractive",
                  sentences: selected.map((s) => ({
                    text: s.text, sourceName: s.sourceName,
                    sourceSlug: s.sourceSlug, verseKey: s.verseKey,
                  })),
                },
              });
            }
            full = "";
          }

          if (full) {
            // Citations are checked, not assumed. A [7] pointing at a passage
            // that was never supplied is exactly the failure a reader cannot
            // catch on their own.
            const cite = LLM.checkCitations(full, numbered);
            send({
              answerEnd: {
                mode,
                cited: cite.cited,
                invalid: cite.invalid,
                warning: cite.invalid.length
                  ? `The answer cited passage${cite.invalid.length > 1 ? "s" : ""} ${cite.invalid.join(", ")}, which ${cite.invalid.length > 1 ? "were" : "was"} not among those retrieved. Treat ${cite.invalid.length > 1 ? "those claims" : "that claim"} with suspicion.`
                  : cite.uncited
                    ? "The answer gave no citations. Check it against the passages below."
                    : undefined,
              },
            });
          }
        }

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
          // `quoted` belonged to the extractive path, which no longer always
          // runs; the passage count is the number that is true in both modes.
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
