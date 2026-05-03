/**
 * RemoteCursorsExtension — colour utilities for collaborative cursor overlays.
 *
 * The actual rendering is done via React overlays in PageEditor (coordsAtPos).
 * This module only exports the colour palette and the deterministic colour
 * assignment function so other components can reuse them.
 */

// ── Colour palette (Google-Docs-inspired) ─────────────────────────────────

const CURSOR_COLORS = [
  "#4285F4", // Google blue
  "#EA4335", // Google red
  "#34A853", // Google green
  "#FF6D00", // deep orange
  "#7C4DFF", // purple
  "#00ACC1", // cyan
  "#E91E63", // pink
  "#F57C00", // orange
];

/**
 * Deterministically maps a userId to one of the cursor colours.
 * Same user always gets the same colour within a session.
 */
export function getUserColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length];
}
