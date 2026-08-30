/**
 * Grounded generation — the layer that makes this a conversation rather than a
 * ranked list.
 *
 * A model DOES write the prose here. That is the point: extractive selection
 * could quote but not explain, compare, or answer a follow-up, and reading it
 * felt like using a search box. What keeps it honest is not the absence of a
 * model but what the model is allowed to see: only the passages retrieved from
 * this corpus, and the conversation so far. It is never asked what it knows.
 *
 * The guarantees that survive:
 *   · every claim must carry a [n] citation into the supplied passages
 *   · a citation that does not resolve is stripped and reported, not shown
 *   · "the passages do not say" is an allowed and expected answer
 *   · nothing reaches the model from the web, ever
 *
 * The guarantee that does NOT survive, stated plainly: a model asked to
 * summarise can still paraphrase a passage inaccurately, in a way that
 * verbatim quotation could not. That is the price of it being a chatbot. The
 * quotes remain on screen underneath every answer so a reader can always check
 * the paraphrase against the source.
 */

export interface Passage {
  n:          number;      // the [n] the model must cite
  sourceName: string;
  verseKey:   string;
  language:   string;
  content:    string;
}

export interface ChatTurn { role: "user" | "assistant"; content: string }

export type Provider = "space" | "groq" | "gemini" | "openai-compatible" | "none";

/**
 * Which provider to use, decided by which key is present.
 *
 * Ordered fastest-first rather than by preference: a free CPU Space generating
 * three tokens a second is a real chatbot but a slow one, so if the user has
 * put a fast free key in the environment, use it.
 */
export function provider(): Provider {
  if (process.env.GROQ_API_KEY)        return "groq";
  if (process.env.GEMINI_API_KEY)      return "gemini";
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY) return "openai-compatible";
  if (process.env.TAFSIR_MODEL_SPACE)  return "space";
  return "none";
}

/**
 * The instruction.
 *
 * The hard part is not stopping the model from inventing — it is stopping that
 * without also stopping it from thinking. An assistant told only to repeat what
 * a passage says is a search engine with prose around it, and it dead-ends on
 * the most useful question a reader asks: "does al-Ṭabarī deal with patience
 * here?" when al-Ṭabarī never writes the word.
 *
 * So the boundary is drawn in a different place. Not repeat-vs-infer, but
 * reasoning ABOUT the supplied passages vs importing facts from OUTSIDE them.
 * Inference is invited; it just has to be labelled as inference and pinned to
 * the passage it came from.
 */
const SYSTEM = `You are a study assistant for classical Qur'anic tafsīr. You reason about the passages you are given. You are not a search engine that repeats them.

You will be given numbered passages from tafsīr works. Passages are always supplied, whether or not they have anything to do with what was said to you.

WHEN IT IS NOT A QUESTION
Not every message is a lookup. A greeting, a thanks, an "ok", a question about what you can do — answer it the way a person would, in a sentence or two, and say nothing about the passages. Do not list them, do not apologise for them, and above all do not announce that you are ready to receive a question: you have just been spoken to, so speak back. Only when you are actually asked something about the Qur'an or its commentary do the rules below apply.

WHAT YOU MAY SAY
1. What a passage states outright — quote the words and cite it.
2. What a passage implies, bears on, or illuminates without naming. Say so in exactly those terms: "al-Ṭabarī does not use the word patience here, but his reading of 'they were not weakened' [2] describes it directly." This is the most useful thing you do. Do not withhold it.
3. That the passages do not reach the question at all.

The line you must not cross is between reasoning ABOUT these passages and importing facts from OUTSIDE them. Inference from the given text is welcome. A date, a name, an incident, or a scholarly position appearing in none of the passages is not — however sure of it you are.

RULES
1. Every claim carries a citation — [1], or [2][3] — pointing at the passage it rests on. Inferences too: cite what you inferred FROM.
2. Mark the difference between the two. If a source says it: "al-Qurṭubī says". If you are reading it out of the passage: "this suggests", "implied here", "he does not say so directly, but". Never let your own inference read as the scholar's words.
3. Never attribute a view to a scholar unless a passage from that scholar supports it.
4. If passages disagree, say so and cite both. Disagreement between commentators is information, not a problem for you to settle.
5. Arabic passages: give the meaning in English, then the key Arabic phrase where it carries weight.
6. If nothing in the passages bears on the question, even indirectly, say so plainly and stop. Do not pad the gap.
7. When you ARE answering a question, be direct: no preamble, no moralising, no "great question". That governs how an answer opens; it is not a ban on ever being civil — see WHEN IT IS NOT A QUESTION above.
8. Use the conversation so far for context, but every fact still comes from the passages.`;

function buildPrompt(question: string, passages: Passage[], history: ChatTurn[]) {
  const context = passages.map((p) =>
    `[${p.n}] ${p.sourceName} — ${p.verseKey} (${p.language})\n${p.content}`
  ).join("\n\n");

  const messages: { role: string; content: string }[] = [{ role: "system", content: SYSTEM }];

  // History is trimmed to the last few turns: a small model's context is
  // limited, and the passages matter more than turn six of the conversation.
  for (const t of history.slice(-6)) {
    messages.push({ role: t.role, content: t.content.slice(0, 2000) });
  }

  messages.push({
    role: "user",
    /* Labelled as a message rather than as "Question:", which framed "hello"
       as a lookup however the instruction was worded. */
    content: `Passages:\n\n${context}\n\n---\n\nThe reader says: ${question}`,
  });
  return messages;
}

// ── Providers ──────────────────────────────────────────────────────────────

async function* streamOpenAICompatible(
  url: string, key: string, model: string,
  messages: { role: string; content: string }[],
): AsyncGenerator<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.2, max_tokens: 900 }),
  });
  if (!res.ok || !res.body) throw new Error(`llm ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const j = JSON.parse(payload);
        const piece = j.choices?.[0]?.delta?.content;
        if (piece) yield piece as string;
      } catch { /* keep-alive frame */ }
    }
  }
}

async function* streamGemini(
  key: string, messages: { role: string; content: string }[],
): AsyncGenerator<string> {
  // Gemini has no system role; the instruction goes in systemInstruction.
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: sys }] },
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
      }),
    },
  );
  if (!res.ok || !res.body) throw new Error(`gemini ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      try {
        const j = JSON.parse(t.slice(5).trim());
        const piece = j.candidates?.[0]?.content?.parts?.[0]?.text;
        if (piece) yield piece as string;
      } catch { /* partial frame */ }
    }
  }
}

/**
 * The self-hosted path: a GGUF model on a free CPU Space.
 *
 * Not streamed, because Gradio's queue delivers a completed result rather than
 * tokens. On two shared vCPUs a short answer takes tens of seconds, so the
 * caller is told this is the slow path and shows it as one block.
 */
async function chatViaSpace(messages: { role: string; content: string }[]): Promise<string> {
  const base = process.env.TAFSIR_MODEL_SPACE!.replace(/\/+$/, "");
  const post = await fetch(`${base}/gradio_api/call/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [JSON.stringify(messages)] }),
  });
  if (!post.ok) throw new Error(`space ${post.status}`);
  const { event_id } = await post.json() as { event_id?: string };
  if (!event_id) throw new Error("space: no event id");

  const stream = await fetch(`${base}/gradio_api/call/chat/${event_id}`);
  const text = await stream.text();
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith("data:")) continue;
    const payload = lines[i].slice(5).trim();
    if (!payload || payload === "null") continue;
    try {
      const parsed = JSON.parse(payload);
      const out = Array.isArray(parsed) ? parsed[0] : parsed;
      if (typeof out === "string" && out.trim()) return out;
      if (out?.text) return String(out.text);
    } catch { /* keep scanning back */ }
  }
  throw new Error("space: no answer in stream");
}

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * The conversational instruction, used when retrieval returned nothing.
 *
 * A study assistant that answers "hello" with "nothing in the corpus matched
 * that" is not careful, it is broken. But the reason the grounded prompt is
 * strict still holds here — there are no passages at all in this mode, so the
 * model has nothing to be right from. The resolution is to let it talk while
 * forbidding it to teach: greet, orient, offer, ask. Never explain a verse or
 * report what a scholar held, because here that could only come from memory.
 */
const CHAT_SYSTEM = `You are the study assistant inside Tafsir Lab, talking with a reader who has the Qur'an open in front of them.

No tafsīr passages were retrieved for this message. Either it is conversational — a greeting, a thank-you, a question about you — or the library genuinely had no match.

Reply briefly and warmly, and keep the conversation on the Qur'an:
- A greeting: greet back, mention what they have open, offer to look at it with them.
- A question about what you are or can do: you read the classical tafsīr in this library and quote it, and you do not answer from anywhere else.
- A real question that found nothing: say plainly that nothing in the library matched it, and suggest a specific verse or a narrower question.

HARD RULE: you have no passages in front of you, so make no factual claim about what any scholar said and do not explain what a verse means. If they want that, ask them to name the verse and you will look it up.

Two or three sentences. No headings, no bullet lists, no citations.`;

/** Route a finished message list to whichever provider is configured. */
async function* dispatch(
  messages: { role: string; content: string }[],
): AsyncGenerator<string> {
  const p = provider();

  if (p === "groq") {
    yield* streamOpenAICompatible(
      "https://api.groq.com/openai/v1/chat/completions",
      process.env.GROQ_API_KEY!,
      // Not groq/compound or compound-mini: those carry built-in web search,
      // and an answer that can reach the web is no longer grounded in the
      // corpus. The llama-3.x chat models this used to name were retired.
      process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
      messages,
    );
    return;
  }
  if (p === "gemini") {
    yield* streamGemini(process.env.GEMINI_API_KEY!, messages);
    return;
  }
  if (p === "openai-compatible") {
    yield* streamOpenAICompatible(
      `${process.env.OPENAI_BASE_URL!.replace(/\/+$/, "")}/chat/completions`,
      process.env.OPENAI_API_KEY!,
      process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
    );
    return;
  }
  if (p === "space") {
    yield await chatViaSpace(messages);
    return;
  }
  throw new Error("no generation provider configured");
}

/** Streams the answer. Yields text pieces as they arrive. */
export async function* answer(
  question: string, passages: Passage[], history: ChatTurn[] = [],
): AsyncGenerator<string> {
  yield* dispatch(buildPrompt(question, passages, history));
}

/** What the reader has open, so a greeting can name it. */
export interface OpenPlace {
  surahName?: string;
  verseKey?:  string;
}

/**
 * Streams a conversational reply, for when no passage was retrieved.
 *
 * Separate from `answer` rather than a flag on it, because the two have
 * opposite obligations: that one must not exceed its passages, this one has
 * none and must not pretend otherwise.
 */
export async function* converse(
  question: string, history: ChatTurn[] = [], place: OpenPlace = {},
): AsyncGenerator<string> {
  const where = place.verseKey
    ? `The reader is on ${place.surahName ?? "the Qur'an"}, verse ${place.verseKey}.`
    : place.surahName
      ? `The reader has ${place.surahName} open.`
      : `You do not know which page the reader has open.`;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: `${CHAT_SYSTEM}\n\n${where}` },
  ];
  for (const t of history.slice(-6)) {
    messages.push({ role: t.role, content: t.content.slice(0, 1000) });
  }
  messages.push({ role: "user", content: question });

  yield* dispatch(messages);
}

/**
 * Check the citations in a finished answer.
 *
 * Returns the numbers cited that do not exist among the supplied passages.
 * A model under instruction rarely invents a citation, but "rarely" is not
 * "never", and an answer carrying [7] when only six passages were supplied is
 * exactly the failure a reader cannot detect on their own.
 */
export function checkCitations(text: string, passages: Passage[]): {
  cited: number[]; invalid: number[]; uncited: boolean;
} {
  const valid = new Set(passages.map((p) => p.n));
  const cited = new Set<number>();
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) cited.add(Number(m[1]));

  const invalid = [...cited].filter((n) => !valid.has(n));
  // An answer of any substance with no citation at all is a red flag; a short
  // "the passages do not cover this" legitimately has none.
  const uncited = cited.size === 0 && text.trim().length > 220;

  return { cited: [...cited].sort((a, b) => a - b), invalid, uncited };
}
