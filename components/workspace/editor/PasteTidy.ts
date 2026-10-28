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
 *     its number on the <li>, restarted at 1 every time.
 *
 * Copying between TafsirLab notes is left exactly as it is: ProseMirror marks
 * its own clipboard with data-pm-slice, and that HTML is already this
 * editor's own.
 */

import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import ListItem from "@tiptap/extension-list-item";
import { pastedColour } from "@/lib/paste-colour";

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

  // Numbering carries on where the source said it was.
  doc.body.querySelectorAll("ol").forEach((ol) => {
    const first = ol.querySelector(":scope > li[value]");
    if (first && !ol.hasAttribute("start")) ol.setAttribute("start", first.getAttribute("value")!);
  });

  return doc.body.innerHTML;
}

export const PasteTidy = Extension.create({
  name: "pasteTidy",
  addProseMirrorPlugins() {
    return [new Plugin({ props: { transformPastedHTML: tidyPastedHTML } })];
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
