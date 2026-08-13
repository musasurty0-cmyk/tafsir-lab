/**
 * Which canvas text boxes belong on the Mushaf page you are looking at.
 *
 * `anchorType: "page"` means "anchored to this Page row" — and a Page row is a
 * whole surah, not a sheet of the Mushaf. Nothing recorded which sheet a box was
 * written on, so a box written on one page came back on every other page of the
 * surah: the notes appeared to follow the reader. Drawings never had this
 * problem because every stroke carries its own `mushafPage` inside the strokes
 * JSON; text boxes are rows and had nowhere to put it.
 *
 * Lives here rather than inline in ModeBPage so the rule can be tested without
 * mounting the canvas — it is the whole of the bug and the whole of the fix.
 */

export interface ScopedBox {
  anchorType: string;
  /** null on rows created before the column existed. */
  mushafPage?: number | null;
}

/**
 * @param currentPage the Mushaf page on screen
 * @param firstPage   first page of the surah; where un-tagged legacy boxes go
 */
export function textBoxOnPage(
  note: ScopedBox,
  currentPage: number,
  firstPage: number | undefined,
): boolean {
  if (note.anchorType !== "page") return false;
  // Legacy rows have no page. Put them on the first page of the surah — the
  // rule page-anchored note cards already use — so they stay reachable in one
  // known place instead of duplicating onto every page.
  if (note.mushafPage == null) return currentPage === firstPage;
  return note.mushafPage === currentPage;
}
