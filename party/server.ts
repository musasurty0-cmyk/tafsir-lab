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
 * And plain requests to /parties/main/<pageId>/ink: the page's handwriting,
 * which lives in the room's own storage (party/ink.ts) rather than in the
 * database.
 *
 * JSON traffic must NEVER reach Yjs provider connections (their handler
 * expects binary and chokes on strings), so connections that have spoken JSON
 * are tracked as "app" connections and presence + strokes go only to those.
 */

import { getServerByName, routePartykitRequest, type Connection, type Lobby, type WSMessage } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { jwtVerify } from "jose";
import type { IncomingMessage, PresenceData } from "./types";
import { ensureInk, importInk, inkSummary, readInk, saveInk, wipeInk } from "./ink";

/** The worker's bindings (worker-configuration.d.ts, from `wrangler types`)
 *  plus the secret shared with the Vercel app, which mints the tokens
 *  (app/api/pages/[pageId]/collab-token). Secrets are set with
 *  `wrangler secret put`, so they are not in the generated types. */
type RoomEnv = Env & { COLLAB_SECRET?: string; SESSION_SECRET?: string; FILES?: R2Bucket };

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

  // ── Ink (party/ink.ts) ─────────────────────────────────────────────────────

  private inkReady = false;
  private inkSql() {
    const sql = this.ctx.storage.sql;
    if (!this.inkReady) { ensureInk(sql); this.inkReady = true; }
    return sql;
  }

  /** GET/POST /parties/main/<pageId>/ink — reached only through inkGate, which
   *  verified the token and set who is asking. */
  async onRequest(req: Request): Promise<Response> {
    if (!new URL(req.url).pathname.endsWith("/ink")) return new Response("Not found", { status: 404 });
    const me = {
      uid:      req.headers.get("x-tl-uid") ?? "",
      name:     req.headers.get("x-tl-name") ?? "",
      canWrite: req.headers.get("x-tl-write") === "1",
    };
    if (!me.uid) return new Response("Unauthorised", { status: 401 });
    const sql = this.inkSql();
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      return readInk(sql, me, q.get("mine"), q.get("others"));
    }
    if (req.method === "POST") {
      let body: unknown;
      try { body = JSON.parse(await req.text()); } catch { return new Response("Bad JSON", { status: 400 }); }
      // All of one save, or none of it.
      return this.ctx.storage.transactionSync(() => saveInk(sql, me, body));
    }
    return new Response("Method not allowed", { status: 405 });
  }

  /** Admin (the app, via /ink-admin): replace an author's ink with a copy. */
  async inkImport(author: string, name: string, updated: number, strokes: { id: string; surface?: string }[]): Promise<number> {
    const sql = this.inkSql();
    return this.ctx.storage.transactionSync(() => importInk(sql, author, name, updated, strokes));
  }
  /** Admin: remove one author's ink, or all of it (a deleted page). */
  async inkWipe(author?: string): Promise<void> {
    const sql = this.inkSql();
    this.ctx.storage.transactionSync(() => wipeInk(sql, author));
  }
  /** Admin: what is stored, to check a copy. */
  async inkSummary() {
    return inkSummary(this.inkSql());
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

/**
 * Ink request gate. The browser reads and saves a page's ink here directly,
 * with the same short-lived token the live connection uses (minted after a
 * workspace-membership check). Verified here, then who is asking travels to
 * the room in headers this sets, never ones the caller sent. Only /ink is
 * open to plain requests; anything else is refused.
 */
async function inkGate(req: Request, lobby: Lobby, env: RoomEnv): Promise<Response | Request> {
  if (!new URL(req.url).pathname.endsWith("/ink")) return new Response("Not found", { status: 404 });
  const secret = env.COLLAB_SECRET || env.SESSION_SECRET;
  if (!secret) return new Response("collab secret not configured", { status: 401 });
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("missing token", { status: 401 });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.room !== lobby.name || typeof payload.uid !== "string") return new Response("token is for a different page", { status: 401 });
    const headers = new Headers(req.headers);
    for (const k of ["x-tl-uid", "x-tl-name", "x-tl-write"]) headers.delete(k);
    headers.set("x-tl-uid", payload.uid);
    headers.set("x-tl-name", typeof payload.name === "string" ? payload.name : "");
    // Every member writes (workspaces.service capabilitiesFor: writeContent).
    headers.set("x-tl-write", ["owner", "admin", "member"].includes(String(payload.role)) ? "1" : "0");
    return new Request(req, { headers });
  } catch {
    return new Response("invalid or expired token", { status: 401 });
  }
}

/** The app's own origins, which may read ink from the browser. */
const INK_ORIGINS = /^(https:\/\/(www\.)?tafsir-lab\.com|https:\/\/tafsir-[a-z0-9-]+\.vercel\.app|http:\/\/localhost:\d+)$/;
function withCors(res: Response, origin: string | null): Response {
  if (!origin || !INK_ORIGINS.test(origin)) return res;
  const out = new Response(res.body, res);
  out.headers.set("Access-Control-Allow-Origin", origin);
  out.headers.set("Vary", "Origin");
  return out;
}

/**
 * POST /ink-admin — the app's own operations on ink, signed with the shared
 * secret and an `admin: "ink"` claim (a page token cannot do this):
 *   { op: "wipe",    pages: string[], author?: string }  a deleted page, workspace or account
 *   { op: "import",  page, author, name, updated, strokes }  the copy from the database
 *   { op: "summary", pages: string[] }  what is stored, to check the copy
 */
async function inkAdmin(req: Request, env: RoomEnv): Promise<Response> {
  const secret = env.COLLAB_SECRET || env.SESSION_SECRET;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !token) return new Response("Unauthorised", { status: 401 });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.admin !== "ink") return new Response("Forbidden", { status: 403 });
  } catch {
    return new Response("invalid or expired token", { status: 401 });
  }
  const b = await req.json() as {
    op?: string; pages?: string[]; page?: string; author?: string; name?: string; updated?: number;
    strokes?: { id: string; surface?: string }[];
  };
  const room = (id: string) => getServerByName(env.Main, id);
  if (b.op === "wipe" && Array.isArray(b.pages)) {
    for (const id of b.pages) await (await room(id)).inkWipe(b.author || undefined);
    return Response.json({ ok: true, pages: b.pages.length });
  }
  if (b.op === "import" && b.page && b.author && Array.isArray(b.strokes)) {
    const n = await (await room(b.page)).inkImport(b.author, b.name ?? "", Number(b.updated) || Date.now(), b.strokes);
    return Response.json({ ok: true, strokes: n });
  }
  if (b.op === "summary" && Array.isArray(b.pages)) {
    const out: Record<string, unknown> = {};
    for (const id of b.pages) out[id] = await (await room(id)).inkSummary();
    return Response.json(out);
  }
  return new Response("Bad request", { status: 400 });
}

/**
 * GET /files/<key>?token=… — a private file (the /dunya A-level papers).
 *
 * The bucket is not public. The Vercel app, after its own password check,
 * signs a token naming exactly one key for a couple of minutes, with the same
 * secret the realtime tokens use; this checks it and streams the file. A
 * token for one file cannot fetch another, and an old link stops working.
 */
async function serveFile(req: Request, env: RoomEnv, key: string): Promise<Response> {
  const secret = env.COLLAB_SECRET || env.SESSION_SECRET;
  if (!secret || !env.FILES) return new Response("Not available", { status: 503 });
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 401 });
  let name = key.split("/").pop() ?? "file.pdf";
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.file !== key) return new Response("Token is for another file", { status: 403 });
    // The app names the file for whoever saves it ("Biology Test 08 - Enzymes.pdf").
    if (typeof payload.name === "string" && payload.name) name = payload.name.slice(0, 150);
  } catch {
    return new Response("Invalid or expired link", { status: 401 });
  }
  const obj = await env.FILES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const ascii = name.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "file.pdf";
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(req: Request, env: RoomEnv): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.startsWith("/files/")) {
      const key = decodeURIComponent(url.pathname.slice("/files/".length));
      if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/.test(key) || key.includes("..")) return new Response("Bad key", { status: 400 });
      return serveFile(req, env, key);
    }
    if (req.method === "POST" && url.pathname === "/ink-admin") return inkAdmin(req, env);

    const origin = req.headers.get("Origin");
    const isInk = url.pathname.endsWith("/ink");
    // Reads are plain GETs and saves are text/plain POSTs (no preflight, so a
    // save sent as the tab closes still goes), but answer one if it comes.
    if (isInk && req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      } }), origin);
    }
    const res = (await routePartykitRequest(req, env, {
      onBeforeConnect: (r, lobby) => gate(r, lobby, env),
      onBeforeRequest: (r, lobby) => inkGate(r, lobby, env),
    })) ?? new Response("Not found", { status: 404 });
    return isInk ? withCors(res, origin) : res;
  },
} satisfies ExportedHandler<RoomEnv>;
