/**
 * POST /api/assistant/read-board — answer a question about your handwriting.
 *
 * Its own route rather than a branch inside /api/assistant, because it is a
 * different pipeline: no corpus retrieval, no embedding, no citation checking
 * against tafsīr. What it has instead is a picture, a transcription, and one
 * passage — the reader's own board.
 *
 * It speaks the SAME newline-delimited event protocol the answer route does
 * ({step}, {answerStart}, {token}, {done}), so the panel reads it with the
 * reader it already has. Keeping the shapes identical is what let this land
 * without touching the answer route at all: if the board feature breaks,
 * ordinary questions are untouched.
 *
 * The transcription is echoed to the client in its own event so the reader
 * can see WHAT WAS READ, not just what was concluded from it. Handwriting
 * recognition is fallible, and a summary built on a misread word is
 * indistinguishable from a correct one unless you can see the reading.
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import * as LLM from "@/lib/tafsir/llm";
import { transcribeBoard } from "@/lib/tafsir/vision";
import type { Passage } from "@/lib/tafsir/answer";

/** A PNG bigger than this is refused rather than posted to a vision API. */
const MAX_IMAGE_CHARS = 6_000_000;   // ~4.5 MB of base64

export async function POST(req: NextRequest) {
  try {
    await getSession();
  } catch {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as {
    image?: unknown; question?: unknown; history?: unknown;
  };
  const image = typeof body.image === "string" ? body.image : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history = Array.isArray(body.history)
    ? (body.history as { role?: unknown; content?: unknown }[])
        .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(-6)
        .map((t) => ({
          role: t.role as "user" | "assistant",
          content: (t.content as string).slice(0, 1000),
        }))
    : [];

  if (!image || image.length > MAX_IMAGE_CHARS) {
    return new Response(JSON.stringify({ error: "No usable picture of the board." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (!LLM.visionProvider()) {
          send({ step: "read", state: "degraded", detail: "No model here can read handwriting" });
          send({
            done: true, quoted: 0, passageCount: 0,
            note: "Reading handwriting needs a Gemini key (GEMINI_API_KEY). Text answers are unaffected.",
          });
          return;
        }

        send({ step: "read", detail: "Reading your board (gemini)" });
        const seen = await transcribeBoard(image);

        if (!seen) {
          send({ step: "read", state: "degraded", detail: "The board could not be read" });
          send({
            done: true, quoted: 0, passageCount: 0,
            note: "Your handwriting could not be read this time. Try again, or zoom the board so the writing is larger.",
          });
          return;
        }
        if (seen.empty || !seen.text.trim()) {
          send({ step: "read", detail: "Nothing written on the board" });
          send({
            done: true, quoted: 0, passageCount: 0,
            note: "There is no handwriting on this board yet.",
          });
          return;
        }

        /* The reading itself, before any conclusion drawn from it. */
        send({ boardText: seen.text });
        send({ step: "read", detail: `Read ${seen.text.split(/\\s+/).length} words of handwriting` });

        /* One passage, named so neither the model nor the reader can mistake
           the reader's own board for a source. This reuses the answering path
           the corpus questions use, including its citation machinery. */
        const passage: Passage & { n: number } = {
          n: 1,
          sourceSlug: "your-board",
          sourceName: "Your board (your handwriting)",
          language: "en",
          verseKey: "",
          content: seen.text,
        };

        const mode = LLM.provider();
        if (mode === "none") {
          /* Nothing to write prose with, but the transcription is itself a
             complete answer to "what did I write" — so give it rather than
             failing. */
          send({ done: true, quoted: 1, passageCount: 1 });
          return;
        }

        send({ step: "answer", detail: `Answering from your board (${mode})` });
        send({
          answerStart: {
            mode,
            cites: [{ n: 1, sourceName: passage.sourceName, verseKey: "" }],
          },
        });

        let spoke = false;
        try {
          for await (const piece of LLM.answer(
            question || "What does this say?", [passage], history,
          )) {
            spoke = true;
            send({ token: piece });
          }
        } catch {
          send({ step: "answer", state: "degraded", detail: "The model did not answer — the reading above is still yours" });
        }

        send({
          done: true,
          quoted: spoke ? 1 : 0,
          passageCount: 1,
          ...(spoke ? {} : { note: "Showing the transcription only." }),
        });
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "Something went wrong reading the board." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
