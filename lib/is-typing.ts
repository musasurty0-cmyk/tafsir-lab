/**
 * Is the user typing into something right now?
 *
 * Single-key shortcuts (the canvas tool hotkeys are h/p/l/a/e/t) must never
 * fire while text is being entered. Guards that only tested for INPUT and
 * TEXTAREA missed the case that actually matters here: the editor and every
 * canvas text container are contenteditable elements, not form fields — so
 * typing "the" switched to text, hand and eraser mid-word.
 *
 * Checks the event target AND the active element, because a keydown during an
 * IME composition or immediately after a programmatic focus can report a
 * target that is not the focused node.
 */
export function isTypingTarget(e: KeyboardEvent): boolean {
  // An IME composition is text entry by definition, whatever the target is.
  if (e.isComposing || e.keyCode === 229) return true;

  const nodes = [e.target, document.activeElement];
  for (const n of nodes) {
    if (!(n instanceof HTMLElement)) continue;
    if (n.isContentEditable) return true;                 // inherited by descendants
    const tag = n.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    // Shadow/portal cases where the target is a child of the editable host.
    if (n.closest?.('[contenteditable="true"], [contenteditable=""], input, textarea, select')) {
      return true;
    }
  }
  return false;
}
