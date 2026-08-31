/**
 * Reading what the reader wrote.
 *
 * The board holds handwriting, and handwriting is not text until something
 * looks at it. That "something" is deliberately not whichever model writes the
 * prose: the chat models this app runs on Groq are fast, good at Arabic and
 * completely blind, so sight is chosen separately (see `visionProvider`) and
 * is Gemini wherever a Gemini key exists.
 *
 * The transcription is treated as the READER'S OWN MATERIAL everywhere
 * downstream — quoted back to them, never dressed up as a source. A misread
 * word in someone's notes is a misreading; a misread word attributed to a
 * commentary would be an invention.
 */

const MODEL = "gemini-2.0-flash";

/**
 * What to ask of a picture of a board.
 *
 * Transcription, not interpretation. The model is told to preserve the layout
 * because the arrangement of a mindmap IS its meaning — a list of words with
 * the arrows thrown away is not what the person drew. It is also told to
 * admit illegibility rather than guess, because a confident wrong reading of
 * someone's own notes is worse than a gap they can fill in themselves.
 */
const TRANSCRIBE_SYSTEM = `You transcribe handwriting from a photograph of someone's study board.

Rules:
- Transcribe what is written, as literally as you can. Do not explain, expand,
  translate or tidy it.
- Preserve the structure: keep headings, lists, boxes and arrows as they are
  arranged. Write an arrow as "->". Show grouping with indentation.
- Arabic stays in Arabic script. Do not transliterate it unless the writer did.
- If a word is genuinely illegible write [?]. Never guess a word to make a
  sentence work.
- If the image contains no handwriting at all, reply with exactly: EMPTY
- Reply with the transcription only. No preamble, no commentary.`;

export interface Transcription {
  /** The handwriting as text, or "" when the board is blank. */
  text: string;
  /** True when the model reported an empty board rather than failing. */
  empty: boolean;
}

/**
 * Transcribe a PNG of the board.
 *
 * Returns null when there is no vision provider or the call fails — every
 * caller treats that as "the board could not be read", which is a thing to
 * say to the reader, not an error to throw at them.
 */
export async function transcribeBoard(
  pngBase64: string,
): Promise<Transcription | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TRANSCRIBE_SYSTEM }] },
          contents: [{
            role: "user",
            parts: [
              { inline_data: { mime_type: "image/png", data: pngBase64 } },
              { text: "Transcribe this board." },
            ],
          }],
          /* Zero temperature: this is a reading task, and there is nothing to
             be creative about in someone else's handwriting. */
          generationConfig: { temperature: 0, maxOutputTokens: 1400 },
        }),
      },
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!raw) return null;
    if (/^EMPTY\b/i.test(raw)) return { text: "", empty: true };
    return { text: raw.slice(0, 6000), empty: false };
  } catch {
    return null;
  }
}
