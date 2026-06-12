/**
 * test-party.ts — end-to-end verification of the deployed PartyKit server.
 *
 * Usage:  npx tsx scripts/test-party.ts [host]
 *         (host defaults to the production deployment)
 *
 * Verifies, against a throwaway room:
 *   1. presence-update → presence-sync broadcast between two app sockets
 *   2. stroke-segment relay (tagged with sender connectionId)
 *   3. presence-leave on disconnect
 *   4. Yjs document sync between two YPartyKitProvider clients
 */

import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";

const HOST = process.argv[2] ?? "tafsir-lab.musasurty0-cmyk.partykit.dev";
const SECURE = !HOST.startsWith("localhost");
const WS_BASE = `${SECURE ? "wss" : "ws"}://${HOST}/parties/main`;

const results: { name: string; pass: boolean; detail?: string }[] = [];

function report(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function connect(room: string, id: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/${room}?_pk=${id}`);
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
  const provA = new YPartyKitProvider(HOST, room, docA);
  const provB = new YPartyKitProvider(HOST, room, docB);

  const synced = (p: YPartyKitProvider) =>
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
  console.log(`Testing PartyKit server at ${HOST}\n`);
  try {
    await testPresenceAndStrokes();
    await testYjsSync();
  } catch (err) {
    report("test run completed without errors", false, String(err));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
