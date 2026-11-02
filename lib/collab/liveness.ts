/**
 * Should this tab hold its live connections open right now?
 *
 * Every open page keeps a realtime room awake on Cloudflare, and on the free
 * plan room time is budgeted per day (13,000 GB-s, about 28 room-hours). A
 * tab left open in the background, or on a desk overnight, held its room
 * awake the whole time, so a dozen students could spend the day's budget
 * without anyone typing. Once it is spent, live sync stops for everyone
 * until midnight UTC.
 *
 * So the live connections (the page's Yjs provider and its app socket) close
 * when nobody is there and reopen the moment somebody is:
 *   · a hidden tab lets go after HIDDEN_GRACE_MS (a quick look at another
 *     app mid-lesson keeps the connection);
 *   · a visible tab that nobody has touched lets go after IDLE_MS (long
 *     enough to read a whole sheet without moving);
 *   · any pointer, key, wheel, touch or scroll, or the tab coming back,
 *     reopens at once. Nothing typed is lost meanwhile: a closed provider
 *     keeps local edits and sends them on reconnect, and the database save
 *     does not depend on the socket at all.
 *
 * Polls have their own, separate gate (lib/idle).
 */

const HIDDEN_GRACE_MS = 60 * 1000;
const IDLE_MS         = 15 * 60 * 1000;

type Listener = (live: boolean) => void;
const listeners = new Set<Listener>();
let started    = false;
let live       = true;
let lastActive = Date.now();
let hiddenAt: number | null = null;

function evaluate() {
  const now  = Date.now();
  const next = document.visibilityState === "visible"
    ? now - lastActive < IDLE_MS
    : hiddenAt !== null && now - hiddenAt < HIDDEN_GRACE_MS;
  if (next === live) return;
  live = next;
  for (const f of listeners) f(live);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (document.visibilityState !== "visible") hiddenAt = Date.now();
  const mark = () => { lastActive = Date.now(); if (!live) evaluate(); };
  for (const ev of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"]) {
    window.addEventListener(ev, mark, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { hiddenAt = null; lastActive = Date.now(); }
    else hiddenAt = Date.now();
    evaluate();
  });
  // The time-based edges (grace over, idle reached) have no event of their own.
  setInterval(evaluate, 15 * 1000);
}

/** Whether live connections should be open now. */
export function isLive(): boolean {
  start();
  return live;
}

/** Called with the new state whenever it changes. Returns an unsubscribe. */
export function onLiveChange(f: Listener): () => void {
  start();
  listeners.add(f);
  return () => { listeners.delete(f); };
}
