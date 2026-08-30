/**
 * The small markdown dialect Lab AI writes, parsed to data.
 *
 * Deliberately not a markdown library, and deliberately not React. Two
 * reasons, in that order:
 *
 *   The output interleaves with citation chips. `[3]` is not a link and not
 *   text — it resolves against the passages that were actually retrieved, and
 *   an unresolvable one has to be marked as such, because a confident citation
 *   pointing at nothing is the one failure a reader cannot catch unaided. A
 *   renderer that returned opaque HTML would have to be unpicked to put those
 *   back.
 *
 *   Returning data rather than elements makes it testable without a DOM. This
 *   is the code that decides whether a reader sees bold text or a pair of
 *   asterisks, so it is worth having tests that do not need a browser to run.
 *
 * The accepted subset is small and entirely known, because we write the prompt
 * that produces it: bold, italic, inline code, ATX headings, and both kinds of
 * list.
 */

export type Inline =
  | { t: "text";   v: string }
  | { t: "strong"; v: string }
  | { t: "em";     v: string }
  | { t: "code";   v: string }
  /** A citation. `n` is the passage number the model pointed at. */
  | { t: "cite";   n: number };

export type Block =
  | { t: "p";  kids: Inline[] }
  | { t: "h";  level: 3 | 4 | 5; kids: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] };

/* Bold is matched before italic so `**x**` is never read as an empty pair of
   italics wrapped around nothing. Citations are capped at two digits: a
   three-digit number in brackets is a year or a page reference far more often
   than it is a passage this app retrieved. */
const INLINE_RE = /\*\*([^*]+?)\*\*|\*([^*\n]+?)\*|`([^`]+?)`|\[(\d{1,2})\]/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(src)) !== null) {
    if (m.index > last) out.push({ t: "text", v: src.slice(last, m.index) });
    if (m[1] !== undefined)      out.push({ t: "strong", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "em",     v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "code",   v: m[3] });
    else                         out.push({ t: "cite",   n: Number(m[4]) });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (!para.length) return;
    // Wrapped source lines are one paragraph, so they rejoin with a space.
    blocks.push({ t: "p", kids: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list.ordered
      ? { t: "ol", items: list.items.map(parseInline) }
      : { t: "ul", items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of src.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara(); flushList();
      /* Clamped to h3–h5. This renders in a panel beside a page that has its
         own title; an h1 in there would out-shout the thing being studied. */
      const level = Math.min(5, heading[1].length + 2) as 3 | 4 | 5;
      blocks.push({ t: "h", level, kids: parseInline(heading[2]) });
      continue;
    }

    /* The space after the marker is what separates a bullet from *italics*
       opening a line, and from `**Bold:**` opening one. */
    const bullet  = /^\s*[*-]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = ordered !== null;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ? bullet[1] : ordered![1]).trim());
      continue;
    }

    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}
