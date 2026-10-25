/**
 * TafsirLab realtime server — one room per workspace page (room id = pageId).
 *
 * A Cloudflare Worker with one Durable Object per room, built on PartyServer.
 * It replaces the hosted PartyKit server, which shut down on 23 Oct 2026 and
 * deleted its projects; from then on every client sat at "Connecting…" then
 * "Offline". The URL shape is unchanged (/parties/main/<pageId>), because the
 * binding is named Main.
 *
 * Two kinds of connections share each room:
 *
 *   • Yjs provider connections (TipTap's YProvider) — speak binary
 *     y-protocol messages, handled by y-partyserver's YServer. The document
 *     is kept in Durable Object storage so late joiners get all of it. A room
 *     that comes up empty is seeded by the first client from the page's saved
 *     database copy (PageEditor), so nothing depends on this store surviving.
 *
 *   • App connections (lib/collab/useRoom's PartySocket) — speak JSON:
 *     presence-update / stroke-segment / stroke-complete / ping.
 *
 * JSON traffic must NEVER reach Yjs provider connections (their handler
 * expects binary and chokes on strings), so connections that have spoken JSON
 * are tracked as "app" connections and presence + strokes go only to those.
 */

import { routePartykitRequest, type Connection, type Lobby, type WSMessage } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { jwtVerify } from "jose";
import type { IncomingMessage, PresenceData } from "./types";

/** The worker's bindings (worker-configuration.d.ts, from `wrangler types`)
 *  plus the secret shared with the Vercel app, which mints the tokens
 *  (app/api/pages/[pageId]/collab-token). Secrets are set with
 *  `wrangler secret put`, so they are not in the generated types. */
type RoomEnv = Env & { COLLAB_SECRET?: string; SESSION_SECRET?: string };

/** Durable Object storage holds values up to 2 MB; keep clear of it. */
const MAX_SNAPSHOT = 1_900_000;

export class TafsirRoom extends YServer {
  /** Live presence per app-connection id */
  private presence = new Map<string, PresenceData>();
  /** Connection ids that have sent JSON — i.e. app sockets, not Yjs providers */
  private appConns = new Set<string>();

  // ── Yjs persistence ─────────────────────────────────────────────────────────

  async onLoad() {
    const saved = await this.ctx.storage.get<Uint8Array>("ydoc");
    if (!saved) return;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, saved);
    return doc;
  }

  async onSave() {
    const update = Y.encodeStateAsUpdate(this.document);
    /* Too large to store: skip rather than fail. The page's database copy is
       the source of truth and re-seeds an empty room. */
    if (update.byteLength > MAX_SNAPSHOT) return;
    await this.ctx.storage.put("ydoc", update);
  }

  /** Send a JSON payload to every app connection (optionally excluding one). */
  private sendToApp(payload: string, excludeId?: string) {
    for (const conn of this.getConnections()) {
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

  // ── Incoming messages ───────────────────────────────────────────────────────

  onMessage(sender: Connection, message: WSMessage) {
    // Binary = Yjs sync and awareness; "__YPS:" strings are YServer's own.
    if (typeof message !== "string" || message.startsWith("__YPS:")) {
      this.handleMessage(sender, message);
      return;
    }

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
      this.sendToApp(JSON.stringify({ ...msg, connectionId: sender.id }), sender.id);
    }
  }

  // ── Connection close ────────────────────────────────────────────────────────

  onClose(conn: Connection, code: number, reason: string, wasClean: boolean) {
    super.onClose(conn, code, reason, wasClean); // drops its Yjs awareness
    this.appConns.delete(conn.id);
    if (this.presence.delete(conn.id)) {
      this.sendToApp(JSON.stringify({ type: "presence-leave", connectionId: conn.id }));
    }
  }

  onError(conn: Connection) {
    this.appConns.delete(conn.id);
    this.presence.delete(conn.id);
  }
}

/**
 * Connection gate. Runs before the socket upgrades, so an unauthorised peer
 * never reaches the room and never joins the Yjs document.
 *
 * The client attaches a `?token=` minted by /api/pages/[pageId]/collab-token,
 * which only issues one after a workspace-membership check. It must verify
 * against the shared secret AND name this room, so a token for one page
 * cannot be replayed against another.
 *
 * Fails CLOSED: no secret configured, or a token that is missing, invalid,
 * expired or for another room, and the connection is refused.
 */
async function gate(req: Request, lobby: Lobby, env: RoomEnv): Promise<Response | void> {
  const deny = (why: string) => new Response(why, { status: 401 });
  const secret = env.COLLAB_SECRET || env.SESSION_SECRET;
  if (!secret) return deny("collab secret not configured");

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return deny("missing token");
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.room !== lobby.name) return deny("token is for a different page");
  } catch {
    return deny("invalid or expired token");
  }
}

export default {
  async fetch(req: Request, env: RoomEnv): Promise<Response> {
    return (
      (await routePartykitRequest(req, env, {
        onBeforeConnect: (r, lobby) => gate(r, lobby, env),
      })) ?? new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<RoomEnv>;
