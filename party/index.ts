/**
 * TafsirLab PartyKit server — one room per workspace page (room id = pageId).
 *
 * Handles three message channels over a single WebSocket connection:
 *
 *   1. Yjs sync (binary ArrayBuffer)
 *      Managed by y-partykit's onConnect/onMessage helpers.
 *      Provides CRDT text collaboration for the TipTap editor.
 *      Document is persisted in PartyKit storage so late joiners get the
 *      full document without waiting for another peer.
 *
 *   2. Presence (JSON string — type: "presence-update")
 *      Each client sends its own presence data on connect and whenever it
 *      changes (mode switch, cursor move).  The server stores the latest
 *      presence per connection and broadcasts the full map to everyone.
 *
 *   3. Canvas strokes (JSON string — type: "stroke-segment" | "stroke-complete")
 *      Broadcast to all peers except the sender.  No server-side storage —
 *      completed strokes are persisted by the client to the existing REST API.
 */

import type * as Party from "partykit/server";
import { onConnect, type YPartyKitOptions } from "y-partykit";

// ── Types shared with the client ──────────────────────────────────────────────

export interface PresenceData {
  userId:    string;
  name:      string;
  color:     string;
  /** Which view mode the user is in */
  mode:      "editor" | "canvas" | "split";
  /** TipTap cursor position (editor mode only) */
  cursor:    { from: number; to: number } | null;
  /** Mushaf page number (canvas mode only) */
  mushafPage: number | null;
}

type IncomingMessage =
  | { type: "presence-update"; data: PresenceData }
  | { type: "stroke-segment";  [key: string]: unknown }
  | { type: "stroke-complete"; [key: string]: unknown };

// ── Server ────────────────────────────────────────────────────────────────────

const YJS_OPTIONS: YPartyKitOptions = {
  persist: true,        // keep doc in PartyKit storage across restarts
  gc:      true,        // garbage-collect deleted Yjs items
};

export default class TafsirRoom implements Party.Server {
  /** Live presence per connection id */
  private presence = new Map<string, PresenceData>();

  constructor(readonly room: Party.Room) {}

  // ── Connection open ─────────────────────────────────────────────────────────

  async onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    // Set up Yjs document sync for this connection.
    // y-partykit sends the full current document state to the new joiner.
    await onConnect(conn, this.room, YJS_OPTIONS);

    // Send current presence map so the new joiner immediately sees everyone.
    conn.send(JSON.stringify({
      type:     "presence-sync",
      presence: Object.fromEntries(this.presence),
    }));
  }

  // ── Incoming messages ───────────────────────────────────────────────────────

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    // Binary messages are Yjs update packets — delegate to y-partykit.
    // Binary messages are Yjs update packets handled internally by y-partykit's
    // per-connection listener (registered in onConnect). Skip them here.
    if (message instanceof ArrayBuffer) return;

    let msg: IncomingMessage;
    try {
      msg = JSON.parse(message) as IncomingMessage;
    } catch {
      return; // ignore malformed messages
    }

    if (msg.type === "presence-update") {
      this.presence.set(sender.id, msg.data);
      // Broadcast updated presence map to everyone (including sender so they
      // can confirm their own presence was registered).
      this.room.broadcast(JSON.stringify({
        type:     "presence-sync",
        presence: Object.fromEntries(this.presence),
      }));
      return;
    }

    if (msg.type === "stroke-segment" || msg.type === "stroke-complete") {
      // Relay canvas strokes to all other peers.
      this.room.broadcast(message, [sender.id]);
      return;
    }
  }

  // ── Connection close ────────────────────────────────────────────────────────

  onClose(conn: Party.Connection) {
    this.presence.delete(conn.id);
    this.room.broadcast(JSON.stringify({
      type:         "presence-leave",
      connectionId: conn.id,
    }));
  }

  onError(conn: Party.Connection, _err: Error) {
    this.presence.delete(conn.id);
  }
}

TafsirRoom satisfies Party.Worker;
