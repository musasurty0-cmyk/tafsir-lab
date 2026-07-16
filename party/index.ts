/**
 * TafsirLab PartyKit server — one room per workspace page (room id = pageId).
 *
 * Two kinds of connections share each room:
 *
 *   • Yjs provider connections (from TipTap's YPartyKitProvider) — speak
 *     ONLY binary y-protocol messages. Handled by y-partykit's onConnect,
 *     which registers its own per-connection listener. Document persists
 *     in PartyKit storage so late joiners get the full doc.
 *
 *   • App connections (from useRoom's PartySocket) — speak ONLY JSON:
 *     presence-update / stroke-segment / stroke-complete.
 *
 * JSON traffic must NEVER be sent to Yjs provider connections (their
 * message handler expects binary and chokes on strings), so we track which
 * connections have spoken JSON ("app" connections) and target presence +
 * stroke relays at those only.
 */

import type * as Party from "partykit/server";
import { onConnect, type YPartyKitOptions } from "y-partykit";

// ── Types shared with the client ──────────────────────────────────────────────

export interface PresenceData {
  userId:    string;
  name:      string;
  color:     string;
  /** Which view mode the user is in */
  mode:      "editor" | "canvas" | "split" | "board";
  /** TipTap cursor position (editor mode only) */
  cursor:    { from: number; to: number } | null;
  /** Mushaf page number (canvas mode only) */
  mushafPage: number | null;
}

type IncomingMessage =
  | { type: "presence-update"; data: PresenceData }
  | { type: "stroke-segment";  [key: string]: unknown }
  | { type: "stroke-complete"; [key: string]: unknown }
  | { type: "ping" };

// ── Server ────────────────────────────────────────────────────────────────────

// NOTE: `gc` must NOT be combined with `persist` — y-partykit throws
// "Cannot use gc and persist at the same time" inside onConnect, which
// killed every connection's setup and silently broke ALL sync.
const YJS_OPTIONS: YPartyKitOptions = {
  persist: { mode: "snapshot" },  // keep doc in PartyKit storage across restarts
};

export default class TafsirRoom implements Party.Server {
  /** Live presence per app-connection id */
  private presence = new Map<string, PresenceData>();
  /** Connection ids that have sent JSON — i.e. app sockets, not Yjs providers */
  private appConns = new Set<string>();

  constructor(readonly room: Party.Room) {}

  /** Send a JSON payload to every app connection (optionally excluding one). */
  private sendToApp(payload: string, excludeId?: string) {
    for (const conn of this.room.getConnections()) {
      if (conn.id === excludeId) continue;
      if (!this.appConns.has(conn.id)) continue;
      try { conn.send(payload); } catch { /* connection mid-close */ }
    }
  }

  private presenceSyncPayload(): string {
    return JSON.stringify({
      type:     "presence-sync",
      presence: Object.fromEntries(this.presence),
    });
  }

  // ── Connection open ─────────────────────────────────────────────────────────

  async onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    // Set up Yjs document sync for this connection. Harmless for app
    // sockets — they never send binary, and they ignore binary frames.
    await onConnect(conn, this.room, YJS_OPTIONS);
  }

  // ── Incoming messages ───────────────────────────────────────────────────────

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    // Binary = Yjs sync packets, handled by y-partykit's own listener.
    if (typeof message !== "string") return;

    let msg: IncomingMessage;
    try {
      msg = JSON.parse(message) as IncomingMessage;
    } catch {
      return; // ignore malformed messages
    }

    // Any JSON message marks this connection as an app socket.
    const isNewAppConn = !this.appConns.has(sender.id);
    this.appConns.add(sender.id);

    // Heartbeat: the client pings periodically so it can detect a silently
    // dropped (half-open) connection when no pong comes back.
    if (msg.type === "ping") {
      try { sender.send(JSON.stringify({ type: "pong" })); } catch { /* ignore */ }
      return;
    }

    if (msg.type === "presence-update") {
      this.presence.set(sender.id, msg.data);
      // Full map to everyone (including sender — confirms registration).
      this.sendToApp(this.presenceSyncPayload());
      return;
    }

    // A first-time app socket that opened with a stroke still deserves the
    // current presence map.
    if (isNewAppConn) {
      try { sender.send(this.presenceSyncPayload()); } catch { /* ignore */ }
    }

    if (msg.type === "stroke-segment" || msg.type === "stroke-complete") {
      // Relay strokes to all other app peers, tagged with the sender's
      // connection id so receivers can track per-peer in-progress strokes.
      this.sendToApp(
        JSON.stringify({ ...msg, connectionId: sender.id }),
        sender.id,
      );
      return;
    }
  }

  // ── Connection close ────────────────────────────────────────────────────────

  onClose(conn: Party.Connection) {
    this.appConns.delete(conn.id);
    if (this.presence.delete(conn.id)) {
      this.sendToApp(JSON.stringify({
        type:         "presence-leave",
        connectionId: conn.id,
      }));
    }
  }

  onError(conn: Party.Connection, _err: Error) {
    this.appConns.delete(conn.id);
    this.presence.delete(conn.id);
  }
}

TafsirRoom satisfies Party.Worker;
