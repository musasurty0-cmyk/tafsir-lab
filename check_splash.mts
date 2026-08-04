/* Drive lib/nav-splash.ts against a fake DOM and clock.
 *
 * The splash is timing behaviour, and timing behaviour claimed in a comment is
 * timing behaviour nobody checks. Run with:  npx tsx check_splash.mts
 */
/* ── A DOM and a clock small enough to reason about ──────────────────────*/
let now = 0;
const timers = new Map();
let nextId = 1;
globalThis.setTimeout = (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; };
globalThis.clearTimeout = (id) => timers.delete(id);
const tick = (ms) => {
  const end = now + ms;
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at);
    if (!due.length) break;
    const [id, t] = due[0];
    timers.delete(id); now = t.at; t.fn();
  }
  now = end;
};

const mkEl = (id = "") => ({
  id, className: "", dataset: {}, textContent: "", innerHTML: "",
  _kids: [], appendChild(c) { this._kids.push(c); },
  querySelector() { return mkEl(); },
  remove() { document._body = document._body.filter((x) => x !== this);
             document._head = document._head.filter((x) => x !== this); },
});
const document = {
  _body: [], _head: [],
  head: { appendChild(c) { document._head.push(c); } },
  body: { appendChild(c) { document._body.push(c); } },
  createElement: () => mkEl(),
  getElementById(id) {
    return [...document._body, ...document._head].find((e) => e.id === id) ?? null;
  },
};
globalThis.document = document;
const painted = () => !!document.getElementById("tl-nav-splash");

/* Globals must exist before the module is evaluated, so the import is dynamic. */
const mod = await import("./lib/nav-splash.ts");

let pass = 0, fail = 0;
const ok = (n, c, d = "") => {
  if (c) { pass++; console.log(`  PASS  ${n}`); }
  else { fail++; console.log(`  FAIL  ${n}${d ? "  - " + d : ""}`); }
};
const reset = () => { timers.clear(); document._body = []; document._head = []; };

console.log("\n- a fast navigation is never covered by a loading screen");
{
  reset();
  mod.showNavSplash();
  ok("nothing paints on the click itself", !painted());
  tick(40);
  ok("nothing has painted 40ms in", !painted());
  mod.hideNavSplash();           // destination arrived
  tick(2000);
  ok("and nothing paints afterwards either", !painted());
}

console.log("\n- a slow navigation still gets feedback, promptly");
{
  reset();
  mod.showNavSplash();
  tick(129);
  ok("still nothing at 129ms", !painted());
  tick(2);
  ok("painted by 131ms", painted());
  console.log("        grace period measured at 130ms");
}

console.log("\n- the route's loading UI continues the SAME verse");
{
  reset();
  mod.showNavSplash();
  tick(200);                     // splash is up
  const idx = mod.adoptNavSplash();
  ok("adoption returns a verse index", Number.isInteger(idx) && idx >= 0 && idx < 7,
     String(idx));
  ok("and takes the overlay down with no fade left behind", !painted());
  ok("nothing lingers in the head either", document._head.length === 0);
}

console.log("\n- adoption works even if the route commits inside the grace period");
{
  reset();
  mod.showNavSplash();
  tick(60);                      // loading.tsx mounts before the splash paints
  const idx = mod.adoptNavSplash();
  ok("the armed verse is handed over anyway", Number.isInteger(idx), String(idx));
  tick(2000);
  ok("the cancelled splash never paints later", !painted());
}

console.log("\n- a cold load has nothing to adopt");
{
  reset();
  ok("adoption returns null", mod.adoptNavSplash() === null);
}

console.log("\n- hiding cancels a pending splash, so it cannot land on an error page");
{
  reset();
  mod.showNavSplash();
  tick(50);
  mod.hideNavSplash();           // error boundary mounts
  tick(5000);
  ok("no overlay appears over the error page", !painted());
}

console.log("\n- the failsafe still releases a stuck overlay");
{
  reset();
  mod.showNavSplash();
  tick(200);
  ok("overlay is up", painted());
  tick(12500);
  ok("overlay is gone after the 12s failsafe", !painted());
}

console.log("\n- arming twice does not stack two overlays");
{
  reset();
  mod.showNavSplash();
  mod.showNavSplash();
  tick(300);
  ok("exactly one overlay in the body",
     document._body.filter((e) => e.id === "tl-nav-splash").length === 1,
     String(document._body.length));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
