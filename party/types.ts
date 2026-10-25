/**
 * Messages the app's room socket (lib/collab/useRoom) and the realtime server
 * (party/server.ts) exchange. Kept apart from the server so the Next.js app
 * can import them without pulling in Cloudflare's worker types.
 */

// ── Types shared with the client ──────────────────────────────────────────────

export interface PresenceData {
  userId:    string;
  name:      string;
  color:     string;
  /** Which view mode the user is in */
  mode:      "editor" | "canvas" | "split" | "board" | "read";
  /** TipTap cursor position (editor mode only) */
  cursor:    { from: number; to: number } | null;
  /** Mushaf page number (canvas mode only) */
  mushafPage: number | null;
}

export type IncomingMessage =
  | { type: "presence-update"; data: PresenceData }
  | { type: "stroke-segment";  [key: string]: unknown }
  | { type: "stroke-complete"; [key: string]: unknown }
  | { type: "ping" };
