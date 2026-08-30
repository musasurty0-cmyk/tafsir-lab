/**
 * Workspace identity marks.
 *
 * A workspace shows its INITIALS, and only ever its initials. It used to be
 * given an emoji at creation so a new one was never an anonymous grey square;
 * a rail of glyphs turned out to read as decoration rather than navigation,
 * and the letters of the name are what people actually recognise. Distinction
 * between workspaces comes from the tone below instead.
 *
 * The `icon` column still exists and is ignored. Nothing writes it any more.
 */

/**
 * Stable hash — same string in, same number out, across devices and reloads.
 *
 * FNV-1a rather than the usual `h * 31 + c`: that one leaves short strings of
 * similar length clustered in the low bits, so plausible workspace names
 * ("Youth Majlis" and "Tafsir Circle") landed on the same icon. FNV avalanches
 * properly, and the final mix spreads the high bits down before the modulo.
 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x2545f491) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Initials, the default mark.
 *
 * One letter per word up to two, so "Youth Majlis" reads YM rather than YO.
 * A single word gives its first two letters. Falls back to "?" rather than an
 * empty box, which would look broken.
 */
export function workspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    /* Take the first two CHARACTERS, not code units: an Arabic or emoji name
       would otherwise be cut through the middle of a surrogate pair. */
    return [...words[0]].slice(0, 2).join("").toUpperCase();
  }
  return words.slice(0, 2).map((w) => [...w][0]).join("").toUpperCase();
}

/**
 * A stable tone per workspace, so several workspaces are distinguishable at a
 * glance even when all of them are showing initials. Muted, in the same family
 * as the app accent — the rail is navigation, not decoration.
 */
export const WORKSPACE_TONES = 6;
export function workspaceTone(id: string, name: string): number {
  return hash(id || name) % WORKSPACE_TONES;
}
