/**
 * Grounded generation — the layer that makes this a conversation rather than a
 * ranked list.
 *
 * This began as quote-only: the model saw the retrieved passages and nothing
 * else, and every claim had to carry a citation. That was honest and it was
 * unusable. Asked "what does Ibn Kathīr say about the basmalah" while holding
 * his commentary on 1:1, it answered that the passages contained no mention of
 * it — because it had been taught to check for the reader's word rather than
 * to read. An assistant that cannot say what the basmalah IS cannot teach.
 *
 * So the line moved, and it is worth being precise about where. It is not
 * "only what is retrieved" any more. It is:
 *
 *   · it may teach from its own learning — terms, context, structure, the
 *     ordinary knowledge a teacher brings to a verse
 *   · it may NOT state what a NAMED scholar or work holds unless a retrieved
 *     passage says so
 *   · the reader must be able to tell the two apart, and the answer is written
 *     to make that visible
 *   · a citation that does not resolve is still reported, not shown
 *   · nothing reaches the model from the web, ever
 *
 * What that costs, stated plainly: general teaching can be wrong in a way
 * quotation cannot, and it carries this app's voice while being wrong. The
 * judgement — musas's, deliberately — is that a study tool which refuses to
 * explain anything is worth less than one that teaches and keeps its
 * attributions honest. The passages stay on screen under every answer so the
 * quoted half can always be checked.
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
 * Can we look at a picture?
 *
 * Separate from `provider()` on purpose. That one answers "who writes the
 * prose", and its answer is Groq wherever a Groq key exists — the chat models
 * we run there are fast and good at Arabic, and they are also text-only. A
 * board full of handwriting is a different question asked of a different
 * model, so the two are chosen independently: text can be Groq while sight is
 * Gemini, which is exactly the arrangement the keys usually describe.
 *
 * Returns null when nothing here can see, and every caller treats that as an
 * ordinary outcome — the board is simply not read, and the reader is told so
 * rather than shown a failure.
 */
export function visionProvider(): "gemini" | null {
  return process.env.GEMINI_API_KEY ? "gemini" : null;
}

/**
 * The instruction.
 *
 * The hard part was never stopping the model inventing. It is stopping that
 * without also stopping it thinking — and the first version of this got the
 * trade wrong in the direction that looks responsible: told to answer only
 * from the passages, it learned to refuse, and refused even when the answer
 * was in front of it.
 *
 * The boundary that survives is narrow and specific: a view attributed to a
 * NAMED scholar must come from a passage. Everything else a teacher does —
 * defining, contextualising, connecting, explaining — is invited, and is
 * marked as the teacher speaking rather than the source.
 */
const SYSTEM = `You are a teacher of the Qur'an, sitting with a reader who has it open in front of them. Teach. Do not behave like a search index with prose around it.

You are given numbered passages retrieved from a library of classical tafsīr. You also have your own learning. Both are yours to use, and they are used differently.

THE PASSAGES
Read them properly before you decide what they cover. A passage on a verse is a passage about that verse's subject even when it does not use the reader's word for it: commentary on 1:1 IS commentary on the basmalah, commentary on 2:255 IS commentary on Ayat al-Kursi. Concluding "the passages do not mention this" while holding commentary on the very verse in question is the single worst thing you can do here, and it has happened.

Cite them with [1], [2] when you draw on them. Quote the words where the wording matters.

YOUR OWN LEARNING
Use it freely to teach: what a term means, where a sūrah sits in the revelation, how a passage connects to the wider Qur'an, what a reader needs to know to make sense of what they are reading. If the passages do not reach the question, answer it anyway from what you know, and say the library did not have commentary on it.

THE ONE LINE YOU DO NOT CROSS
Never state what a NAMED scholar or a NAMED work holds unless a passage in front of you says so. Not al-Ṭabarī, not Ibn Kathīr, not al-Qurṭubī, not al-Jalālayn — however sure you are. Attributing a view to a scholar who may never have held it is the one error this app exists to prevent, and it is not repairable by a reader who trusted you.

So: "Ibn Kathīr says [2]" requires passage 2. "Commentators generally hold" or "the classical view is" does not, and is how you should say it when you are teaching rather than quoting.

HOW TO WRITE
Be warm and direct, the way a good teacher is with someone who came to learn. Answer the question first, then open it out.
Keep the reader able to tell your teaching from the sources: "Ibn Kathīr says [1]" against "in general" or "as it is usually explained".
Where the passages disagree, say so and cite both — disagreement between commentators is information, not a problem to settle.
Arabic: give the meaning in English, then the phrase itself where it carries weight.
Where you are unsure, or where scholars genuinely differ, say that plainly rather than choosing for the reader.
No preamble, no "great question", no moralising. Do not pad, and do not perform certainty you do not have.`;

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
const CHAT_SYSTEM = `You are a teacher of the Qur'an inside Tafsir Lab, talking with a reader who has it open in front of them.

Nothing was retrieved from the tafsīr library for this message — either it is conversational, or the library had no match for it.

Be warm, and be useful. A greeting gets a greeting back and an offer to look at something together. A question about what you are: you read the classical tafsīr in this library, quote it, and can teach around it.

If it is a real question, answer it from your own learning rather than turning them away, and say the library had no commentary to quote for it. Offer a verse you could look up together.

THE ONE LINE YOU DO NOT CROSS: you have no passages here, so do not state what any NAMED scholar or work holds. Teach generally — "the classical view is", "commentators generally" — or offer to look the verse up.

A few sentences, conversational. No headings, no bullet lists, no citations.`;

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
/**
 * Is this a message to answer, or a corpus to search?
 *
 * The conversational reply used to trigger on retrieving nothing, which worked
 * only while retrieval was lexical. Semantic search has no such thing as "no
 * results": it returns its nearest neighbours, and a vector space always has
 * some. So "hello" arrives with twelve passages attached and the assistant
 * dutifully reports that they do not address it.
 *
 * A distance threshold looked like the obvious fix and does not survive
 * measurement. Nearest-hit cosine distance on the deployed corpus:
 *
 *     what does the Qur'an say about patience in hardship   0.110
 *     what does al-Ṭabarī say about the opening of al-Fātiḥa 0.122
 *     HELLO                                                  0.144
 *     thanks, that was helpful                               0.149
 *     how do I keep going when everything falls apart        0.151
 *
 * The genuinely semantic question sits FARTHER from its answer than the
 * greeting does, so every cutoff that rejects small talk also rejects the one
 * capability worth having. e5 puts all short English text in much the same
 * neighbourhood; the distance simply does not carry this signal.
 *
 * Asking is cheap and reliable. It runs alongside retrieval rather than before
 * it, so a real question waits for nothing, and it fails towards LOOKUP: a
 * wrong CHAT costs the reader their answer, a wrong LOOKUP costs one search
 * nobody sees.
 */
const INTENT_SYSTEM = `Decide whether the reader's message asks for something from the Qur'an or its commentary, or is ordinary conversation.

Reply with exactly one word: LOOKUP or CHAT.

CHAT — greetings, farewells, thanks, acknowledgements ("ok", "got it", "nice"), and questions about you or what you are able to do.

LOOKUP — anything that wants an answer out of the text: a verse, a sūrah, a scholar, a theme, a word. This includes vague questions, questions about living that expect scripture to answer them, and follow-ups to what you just said. It also includes anything about the reader's OWN material — their notes, this page, what they have written — because those are fetched and handed to you the same way passages are.

If you are not sure, reply LOOKUP.`;

/**
 * Unmistakably about the reader's own writing. Settled without a round trip:
 * "summarise my notes on this page" was being classified CHAT — it asks
 * nothing of the corpus — which sent it down the path that is handed no
 * passages, so it answered that it had no access to the notes that had just
 * been read for it.
 */
const OWN_MATERIAL = /\b(?:my|these|this|the)\s+(?:own\s+)?(?:notes?|page|writing|document|annotations?)\b/i;

export async function isSmallTalk(
  question: string, history: ChatTurn[] = [],
): Promise<boolean> {
  if (OWN_MATERIAL.test(question)) return false;
  if (provider() === "none") return false;

  const messages = [
    { role: "system", content: INTENT_SYSTEM },
    /* One prior turn, so "yes, go on" is read as a follow-up rather than as
       small talk. More than one is noise for a single-word decision. */
    ...history.slice(-1).map((t) => ({ role: t.role, content: t.content.slice(0, 300) })),
    { role: "user", content: question.slice(0, 500) },
  ];

  try {
    let out = "";
    for await (const piece of dispatch(messages)) {
      out += piece;
      if (out.length > 200) break;
    }
    const said = out.toUpperCase();
    /* Some models narrate before answering, so look for the word rather than
       demanding the whole reply be it — and require CHAT to appear alone,
       since a hedged answer naming both should search. */
    return said.includes("CHAT") && !said.includes("LOOKUP");
  } catch {
    // A classifier that fails must not cost anyone their answer.
    return false;
  }
}

/**
 * Turn a finished answer into a mindmap tree.
 *
 * A second call rather than asking the first one to emit JSON alongside its
 * prose: the answer is streamed to a reader and must stay readable, and a
 * model asked to do both at once reliably damages one of them. This runs only
 * when the reader has asked for a map, so the extra call is never on the path
 * of an ordinary question.
 *
 * Returns null on anything unexpected — no provider, malformed JSON, a shape
 * that is not a tree. The caller treats that as "no map offered", because a
 * broken mindmap dumped onto someone's board is worse than none.
 */
const MINDMAP_SYSTEM = `You turn a passage of study notes into a mindmap.

Reply with JSON ONLY — no prose, no code fence. The shape is exactly:
{"label":"<the subject>","children":[{"label":"<branch>","children":[{"label":"<leaf>"}]}]}

Rules:
- The root label names the subject in under six words.
- Three to six branches. Each branch has two to four leaves, or none.
- Never deeper than root -> branch -> leaf.
- A label is a PHRASE, not a sentence: under nine words, no trailing full stop.
- Use only what the passage says. Do not add scholars, rulings or claims it
  does not contain. Transliterate Arabic the way the passage does.`;

export async function mindmapFrom(
  text: string, subject?: string,
): Promise<{ label: string; children?: unknown[] } | null> {
  if (provider() === "none") return null;

  const messages = [
    { role: "system", content: MINDMAP_SYSTEM },
    {
      role: "user",
      content: (subject ? `Subject: ${subject}

` : "") + text.slice(0, 6000),
    },
  ];

  try {
    let out = "";
    for await (const piece of dispatch(messages)) {
      out += piece;
      if (out.length > 4000) break;
    }
    /* Models fence JSON even when told not to, and some narrate first. Take
       the outermost braces rather than trusting the reply to be bare. */
    const a = out.indexOf("{"), b = out.lastIndexOf("}");
    if (a === -1 || b <= a) return null;
    const parsed: unknown = JSON.parse(out.slice(a, b + 1));
    if (!parsed || typeof parsed !== "object") return null;
    const root = parsed as { label?: unknown; children?: unknown };
    if (typeof root.label !== "string" || !root.label.trim()) return null;
    return root as { label: string; children?: unknown[] };
  } catch {
    return null;
  }
}

export function checkCitations(text: string, passages: Passage[]): {
  cited: number[]; invalid: number[]; uncited: boolean;
} {
  const valid = new Set(passages.map((p) => p.n));
  const cited = new Set<number>();
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) cited.add(Number(m[1]));

  const invalid = [...cited].filter((n) => !valid.has(n));
  /* No longer a red flag — the assistant is allowed to teach, and teaching
     carries no citations by definition. It is still worth telling the reader
     which kind of answer they are looking at, so this is reported as a fact
     about the answer rather than as a fault in it. */
  const uncited = cited.size === 0 && text.trim().length > 220;

  return { cited: [...cited].sort((a, b) => a - b), invalid, uncited };
}
