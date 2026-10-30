/**
 * Pasting from OneNote, Word or Google Docs, so it looks like it did there.
 *
 * Those apps copy HTML that this editor read badly:
 *   · a heading inside a bullet ("• The concept of Allah's anger", set as
 *     Heading 3) was pushed out of the list, leaving an empty bullet behind —
 *     fixed by ListItemWithHeading below, not here;
 *   · their colour sits on the heading or paragraph itself, and only colour on
 *     a run of text survives a paste, so OneNote's blue headings came in white;
 *   · their default text colour (black, dark grey) DID survive, and a pasted
 *     quote all but vanished on the dark theme;
 *   · their own type size and face (11pt Calibri) came in on every run,
 *     shrinking pasted lines below the page's text and making headings look
 *     like body text;
 *   · a numbered list split by the app into one <ol> per item, each saying
 *     its number on the <li>, restarted at 1 every time;
 *   · OneNote's free-floating containers came as one big table whose empty
 *     cells were spacing, squeezing every container into a narrow column;
 *   · direction was left to the browser's first-strong-character guess, so an
 *     English line opening with an Arabic word read right to left;
 *   · blank lines, bold inside headings and heading levels came however the
 *     source had them, unlike the rest of the page.
 *
 * The last three follow the rules the cohort workspace's sheets were tidied
 * to (30 Oct 2026): one direction per line by its letters (lib/text-
 * direction), no blank line beside a heading and never two in a row, no bold
 * inside a heading, and the pasted headings' levels starting at H2.
 *
 * Copying between TafsirLab notes is left exactly as it is: ProseMirror marks
 * its own clipboard with data-pm-slice, and that HTML is already this
 * editor's own.
 */

import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import ListItem from "@tiptap/extension-list-item";
import { pastedColour } from "@/lib/paste-colour";
import { directionOf } from "@/lib/text-direction";

const BLOCKS = "h1,h2,h3,h4,h5,h6,p,li,div,td,th,blockquote";

export function tidyPastedHTML(html: string): string {
  if (html.includes("data-pm-slice") || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style, meta, link, script, title, xml").forEach((n) => n.remove());

  // A colour on a block moves onto its text, where the editor keeps it.
  doc.body.querySelectorAll<HTMLElement>(BLOCKS).forEach((el) => {
    const c = pastedColour(el.style.color);
    el.style.removeProperty("color");
    if (!c || !el.firstChild) return;
    const span = doc.createElement("span");
    span.style.color = c;
    while (el.firstChild) span.appendChild(el.firstChild);
    el.appendChild(span);
  });

  doc.body.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    // The page's type scale, not the source app's.
    el.style.removeProperty("font-size");
    el.style.removeProperty("font-family");
    el.style.removeProperty("line-height");
    if (el.style.color) {
      const c = pastedColour(el.style.color);
      if (c) el.style.color = c; else el.style.removeProperty("color");
    }
    // A highlighter run becomes the editor's own highlight.
    const bg = el.tagName === "SPAN" ? el.style.backgroundColor : "";
    if (bg && !/^(transparent|white|#fff(fff)?|rgba?\(255,\s*255,\s*255)/i.test(bg)) {
      const mark = doc.createElement("mark");
      mark.setAttribute("data-color", bg);
      mark.style.backgroundColor = bg;
      el.style.removeProperty("background-color");
      el.parentNode?.insertBefore(mark, el);
      mark.appendChild(el);
    }
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
  });

  unwrapLayoutTables(doc);
  tidyHeadings(doc);
  setDirections(doc);
  tidyBlankLines(doc);

  // Numbering carries on where the source said it was.
  doc.body.querySelectorAll("ol").forEach((ol) => {
    const first = ol.querySelector(":scope > li[value]");
    if (first && !ol.hasAttribute("start")) ol.setAttribute("start", first.getAttribute("value")!);
  });

  return doc.body.innerHTML;
}

const DIRECTIONAL = new Set(["paragraph", "heading", "listItem", "blockquote"]);

/** Whether a block holds anything but spaces. */
const hasText = (el: Element) => !!(el.textContent ?? "").replace(/[\s\u00a0\u200b]+/g, "");
const hasMedia = (el: Element) => !!el.querySelector("img, video, iframe, svg");

/**
 * A table whose cells are mostly empty is OneNote's layout, not a table: its
 * containers are laid out in order instead, top to bottom, left to right.
 * Real tables inside them are kept as they are.
 */
function unwrapLayoutTables(doc: Document) {
  for (const table of [...doc.body.querySelectorAll("table")]) {
    if (!table.isConnected) continue;
    const cells = [...table.rows].flatMap((r) => [...r.cells]);
    const empty = cells.filter((c) => !hasText(c) && !hasMedia(c)).length;
    if (cells.length < 4 || empty / cells.length <= 0.4) continue;
    const out = doc.createDocumentFragment();
    for (const cell of cells) {
      if (!hasText(cell) && !hasMedia(cell)) continue;
      // A container's loose text becomes a paragraph of its own.
      const inline = [...cell.childNodes].every((n) => n.nodeType === Node.TEXT_NODE || !/^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE)$/.test((n as Element).tagName));
      if (inline) {
        const p = doc.createElement("p");
        while (cell.firstChild) p.appendChild(cell.firstChild);
        out.appendChild(p);
      } else {
        while (cell.firstChild) out.appendChild(cell.firstChild);
      }
    }
    table.replaceWith(out);
  }
}

/** No bold inside a heading (it is bold already), and levels from H2 down. */
function tidyHeadings(doc: Document) {
  const headings = [...doc.body.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")];
  for (const h of headings) {
    h.querySelectorAll("b, strong").forEach((b) => b.replaceWith(...b.childNodes));
    h.querySelectorAll<HTMLElement>("[style]").forEach((el) => el.style.removeProperty("font-weight"));
  }
  // The page's title is the sheet's; what is pasted starts at its sections.
  const used = [...new Set(headings.filter(hasText).map((h) => Number(h.tagName[1])))].sort();
  const to = new Map(used.map((l, i) => [l, Math.min(3, used.length >= 3 ? i + 1 : i + 2)]));
  for (const h of headings) {
    if (!hasText(h)) { h.remove(); continue; }
    const level = to.get(Number(h.tagName[1])) ?? 3;
    if (`H${level}` === h.tagName) continue;
    const next = doc.createElement(`h${level}`);
    for (const a of [...h.attributes]) next.setAttribute(a.name, a.value);
    while (h.firstChild) next.appendChild(h.firstChild);
    h.replaceWith(next);
  }
}

/** Each line reads the way its letters do: Arabic right to left, English left to right. */
function setDirections(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>("p, h1, h2, h3, li, blockquote").forEach((el) => {
    // A list item's own line, not the nested list under it.
    let text = el.textContent ?? "";
    if (el.tagName === "LI") {
      const own = el.cloneNode(true) as HTMLElement;
      own.querySelectorAll("ul, ol").forEach((l) => l.remove());
      text = own.textContent ?? "";
    }
    const dir = directionOf(text);
    if (dir) el.setAttribute("dir", dir); else el.removeAttribute("dir");
  });
}

/** One blank line at most, none beside a heading, none at the start or end. */
function tidyBlankLines(doc: Document) {
  const blank = (el: Element | null) => !!el && el.tagName === "P" && !hasText(el) && !hasMedia(el);
  const heading = (el: Element | null) => !!el && /^H[1-6]$/.test(el.tagName);
  // Until nothing changes: removing one blank line can put another beside a heading.
  for (let changed = true; changed;) {
    changed = false;
    for (const p of [...doc.body.querySelectorAll("p")]) {
      if (!blank(p)) continue;
      const prev = p.previousElementSibling, next = p.nextElementSibling;
      if (blank(prev) || heading(prev) || heading(next) || (!prev && p.parentElement === doc.body)) { p.remove(); changed = true; }
    }
  }
  while (blank(doc.body.lastElementChild)) doc.body.lastElementChild!.remove();
}

export const PasteTidy = Extension.create({
  name: "pasteTidy",
  addProseMirrorPlugins() {
    return [new Plugin({
      props: { transformPastedHTML: tidyPastedHTML },
      /* A paste's first line joins the paragraph the caret was in, and so
         takes that paragraph's direction rather than its own. After a paste,
         every line it touched that has no direction of its own gets one. */
      appendTransaction(trs, _old, state) {
        const pasted = trs.filter((t) => t.getMeta("uiEvent") === "paste" && t.docChanged);
        if (!pasted.length) return null;
        let from = state.doc.content.size, to = 0;
        for (const t of pasted) {
          t.mapping.maps.forEach((m) => m.forEach((_s, _e, ns, ne) => { from = Math.min(from, ns); to = Math.max(to, ne); }));
        }
        if (from >= to) return null;
        const tr = state.tr;
        state.doc.nodesBetween(from, Math.min(to, state.doc.content.size), (node, pos) => {
          if (!DIRECTIONAL.has(node.type.name) || !("dir" in node.attrs) || node.attrs.dir) return;
          const dir = directionOf(node.textContent);
          if (dir) tr.setNodeAttribute(pos, "dir", dir);
        });
        return tr.docChanged ? tr : null;
      },
    })];
  },
});

/**
 * A list item whose first line may be a heading. StarterKit's insists on a
 * paragraph, so a heading in a bullet — normal in OneNote — was lifted out of
 * the list on paste and the bullet left empty. Enter at the end of one still
 * starts the next item as plain text.
 */
export const ListItemWithHeading = ListItem.extend({
  content: "(paragraph | heading) block*",
});
