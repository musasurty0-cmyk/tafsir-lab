/**
 * Lab AI's answer, as editor content.
 *
 * "Add to editor" has to cross a format boundary: the assistant writes
 * markdown, the page stores a TipTap document. Rather than a second parser,
 * this walks the same block tree `lib/lab-markdown.ts` already produces for
 * rendering — so what lands in the note is the same structure the reader was
 * looking at when they pressed the button, and a markdown bug can only ever be
 * wrong in one place.
 *
 * Citations are the one thing that genuinely changes on the way across. On
 * screen `[1]` is a chip you can hover to see which passage it points at; in a
 * note, detached from the conversation that retrieved it, a bare number means
 * nothing a week later. So it is resolved to what it actually referred to —
 * `[Ibn Kathīr 61:4]` — which is the whole reason for grounding answers in
 * named sources in the first place. An unresolvable number degrades to `[1]`
 * rather than vanishing: a citation that silently disappears turns a sourced
 * claim into an unsourced one, which is the worst outcome available here.
 */

import { parseBlocks, type Block, type Inline } from "@/lib/lab-markdown";

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string }[];
}

/** Given a citation number, the reference it stands for, or null if unknown. */
export type CiteResolver = (n: number) => string | null | undefined;

const MARK: Record<string, string | null> = {
  text: null, strong: "bold", em: "italic", code: "code",
};

function textNode(value: string, mark: string | null): TiptapNode | null {
  /* An empty text node is invalid in a ProseMirror document and throws on
     insert rather than rendering as nothing. */
  if (!value) return null;
  return mark ? { type: "text", text: value, marks: [{ type: mark }] }
              : { type: "text", text: value };
}

function inlineToNodes(kids: Inline[], resolve?: CiteResolver): TiptapNode[] {
  const out: TiptapNode[] = [];
  for (const k of kids) {
    if (k.t === "cite") {
      const ref = resolve?.(k.n);
      const node = textNode(ref ? ` [${ref}]` : ` [${k.n}]`, null);
      if (node) out.push(node);
      continue;
    }
    const node = textNode(k.v, MARK[k.t] ?? null);
    if (node) out.push(node);
  }
  return out;
}

/** A list item wraps its text in a paragraph — TipTap's schema requires it. */
function listItem(kids: Inline[], resolve?: CiteResolver): TiptapNode {
  const content = inlineToNodes(kids, resolve);
  return {
    type: "listItem",
    content: [content.length ? { type: "paragraph", content } : { type: "paragraph" }],
  };
}

function blockToNode(b: Block, resolve?: CiteResolver): TiptapNode | null {
  if (b.t === "p") {
    const content = inlineToNodes(b.kids, resolve);
    /* Drop empty paragraphs rather than inserting blank lines into someone's
       notes. The reader asked for the answer, not for its whitespace. */
    return content.length ? { type: "paragraph", content } : null;
  }
  if (b.t === "h") {
    const content = inlineToNodes(b.kids, resolve);
    return content.length
      ? { type: "heading", attrs: { level: b.level }, content }
      : null;
  }
  const type = b.t === "ul" ? "bulletList" : "orderedList";
  const items = b.items.map((it) => listItem(it, resolve));
  return items.length ? { type, content: items } : null;
}

/**
 * Markdown from Lab AI to TipTap nodes, ready to insert.
 *
 * Returns an array because an answer is several blocks; insert it as one
 * command so it lands as a single undo step.
 */
export function labMarkdownToTiptap(
  markdown: string,
  resolve?: CiteResolver,
): TiptapNode[] {
  return parseBlocks(markdown)
    .map((b) => blockToNode(b, resolve))
    .filter((n): n is TiptapNode => n !== null);
}
