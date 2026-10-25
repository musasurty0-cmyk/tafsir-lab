/**
 * test-party.ts — end-to-end verification of the realtime server (party/server.ts).
 *
 * Usage:  COLLAB_SECRET=… npx tsx scripts/test-party.ts [host]
 *         host defaults to localhost:1999 (npm run party:dev); COLLAB_SECRET is
 *         the secret the server verifies tokens with, so this can mint its own.
 *
 * Verifies, against throwaway rooms:
 *   0. the gate: no token, a token for another room, a wrong secret — refused
 *   1. presence-update → presence-sync broadcast between two app sockets
 *   2. stroke-segment relay (tagged with sender connectionId)
 *   3. presence-leave on disconnect
 *   4. Yjs document sync between two YProvider clients
 */

import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { SignJWT } from "jose";

const HOST = process.argv[2] ?? "localhost:1999";
const SECURE = !HOST.startsWith("localhost");
const WS_BASE = `${SECURE ? "wss" : "ws"}://${HOST}/parties/main`;
const SECRET = process.env.COLLAB_SECRET ?? "";
if (!SECRET) { console.error("Set COLLAB_SECRET to the server's secret."); process.exit(2); }

/** A token exactly like /api/pages/[pageId]/collab-token mints. */
function token(room: string, secret = SECRET) {
  return new SignJWT({ room, uid: "e2e", role: "owner" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m")
    .sign(new TextEncoder().encode(secret));
}

const results: { name: string; pass: boolean; detail?: string }[] = [];

function report(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connect(room: string, id: string, tok?: string): Promise<WebSocket> {
  const tk = tok ?? await token(room);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/${room}?_pk=${id}&token=${encodeURIComponent(tk)}`);
    ws.binaryType = "arraybuffer";
    const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
    ws.addEventListener("open",  () => { clearTimeout(t); resolve(ws); });
    ws.addEventListener("error", (e) => { clearTimeout(t); reject(e); });
  });
}

/** Collect JSON messages on a socket into an inspectable array. */
function collectJson(ws: WebSocket): { messages: Record<string, unknown>[] } {
  const box = { messages: [] as Record<string, unknown>[] };
  ws.addEventListener("message", (evt) => {
    if (typeof evt.data !== "string") return;
    try { box.messages.push(JSON.parse(evt.data)); } catch { /* ignore */ }
  });
  return box;
}

async function testGate() {
  const room = `e2e-gate-${Date.now()}`;
  const refused = async (label: string, tok: string) => {
    try { const ws = await connect(room, "gate", tok); ws.close(); report(`gate: ${label} refused`, false, "it connected"); }
    catch { report(`gate: ${label} refused`, true); }
  };
  await refused("no token", "");
  await refused("token for another room", await token(`${room}-other`));
  await refused("token signed with the wrong secret", await token(room, "not-the-secret"));
  try { const ws = await connect(room, "gate-ok"); ws.close(); report("gate: valid token accepted", true); }
  catch (e) { report("gate: valid token accepted", false, String(e)); }
}

async function testPresenceAndStrokes() {
  const room = `e2e-test-${Date.now()}`;
  const a = await connect(room, "conn-alpha");
  const b = await connect(room, "conn-beta");
  const aBox = collectJson(a);
  const bBox = collectJson(b);

  const presence = (name: string) => ({
    type: "presence-update",
    data: { userId: `u-${name}`, name, color: "#3b82f6", mode: "editor", cursor: null, mushafPage: null },
  });

  a.send(JSON.stringify(presence("Alpha")));
  await wait(700);
  b.send(JSON.stringify(presence("Beta")));
  await wait(1200);

  // 1. A should now hold a presence map containing Beta
  const aSync = aBox.messages.filter((m) => m.type === "presence-sync").at(-1) as
    { presence?: Record<string, { name: string }> } | undefined;
  const aSeesBeta = !!aSync && Object.values(aSync.presence ?? {}).some((p) => p.name === "Beta");
  report("presence: A sees B after B joins", aSeesBeta,
    aSeesBeta ? undefined : `last sync: ${JSON.stringify(aSync ?? "none")}`);

  const bSync = bBox.messages.filter((m) => m.type === "presence-sync").at(-1) as
    { presence?: Record<string, { name: string }> } | undefined;
  const bSeesAlpha = !!bSync && Object.values(bSync.presence ?? {}).some((p) => p.name === "Alpha");
  report("presence: B sees A in initial sync", bSeesAlpha,
    bSeesAlpha ? undefined : `last sync: ${JSON.stringify(bSync ?? "none")}`);

  // 2. Stroke relay A → B, tagged with connectionId
  a.send(JSON.stringify({
    type: "stroke-segment",
    points: [[10, 20, 0.5], [12, 24, 0.5]],
    mushafPage: 1, color: "#dc2626", width: 2.5,
  }));
  await wait(1200);

  const bStroke = bBox.messages.find((m) => m.type === "stroke-segment") as
    { connectionId?: string; points?: unknown[] } | undefined;
  report("strokes: B receives A's live segment", !!bStroke?.points,
    bStroke ? `connectionId=${bStroke.connectionId}` : "no stroke-segment received");
  report("strokes: segment tagged with sender id", bStroke?.connectionId === "conn-alpha",
    `got ${bStroke?.connectionId ?? "nothing"}`);

  const aStrokeEcho = aBox.messages.find((m) => m.type === "stroke-segment");
  report("strokes: sender does NOT receive own echo", !aStrokeEcho);

  // 3. presence-leave when A disconnects
  a.close();
  await wait(1500);
  const bLeave = bBox.messages.find((m) => m.type === "presence-leave") as
    { connectionId?: string } | undefined;
  report("presence: B notified when A leaves", bLeave?.connectionId === "conn-alpha",
    `got ${bLeave?.connectionId ?? "nothing"}`);

  b.close();
}

async function testYjsSync() {
  const room = `e2e-yjs-${Date.now()}`;

  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const params = async () => ({ token: await token(room) });
  const provA = new YProvider(HOST, room, docA, { params });
  const provB = new YProvider(HOST, room, docB, { params });

  const synced = (p: YProvider) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("yjs sync timeout")), 10000);
      if (p.synced) { clearTimeout(t); resolve(); return; }
      p.on("synced", () => { clearTimeout(t); resolve(); });
    });

  await Promise.all([synced(provA), synced(provB)]);

  docA.getText("t").insert(0, "bismillah");
  await wait(2000);

  const received = docB.getText("t").toString();
  report("yjs: edit on A replicates to B", received === "bismillah", `B sees "${received}"`);

  // Edit in the other direction too
  docB.getText("t").insert(received.length, " — synced");
  await wait(2000);
  const back = docA.getText("t").toString();
  report("yjs: edit on B replicates to A", back === "bismillah — synced", `A sees "${back}"`);

  provA.destroy();
  provB.destroy();
}

(async () => {
  console.log(`Testing the realtime server at ${HOST}\n`);
  try {
    await testGate();
    await testPresenceAndStrokes();
    await testYjsSync();
  } catch (err) {
    report("test run completed without errors", false, String(err));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
