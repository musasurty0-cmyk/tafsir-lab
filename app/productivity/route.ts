/**
 * GET /productivity — a private timetable, behind a password.
 *
 * A page of its own rather than part of the app: one HTML document, its
 * script and stylesheet from /productivity-app/, the same files the desktop
 * copy runs. Until the password is given (lib/productivity/gate.ts) only the
 * gate is sent; the plan itself lives in the database, never in this public
 * repository, and comes inline with the page once you are through.
 */

import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess, PLAN_ID } from "@/lib/productivity/gate";

export const dynamic = "force-dynamic";

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%230A0A0A'/%3E%3Ctext x='32' y='45' font-family='Georgia,serif' font-size='36' font-weight='700' fill='%23fff' text-anchor='middle'%3ET%3C/text%3E%3C/svg%3E";

const head = (title: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0a0a0a">
<title>${title}</title>
<link rel="icon" href="${ICON}">
<link rel="apple-touch-icon" href="/productivity-app/icon.png">
<link rel="stylesheet" href="/productivity-app/styles.css">
</head>`;

const GATE = `${head("Productivity · TafsirLab")}
<body class="pd">
<main class="pd-gate">
  <span class="mark mark-lg" aria-hidden="true">T</span>
  <h1>Productivity.</h1>
  <p class="pd-gate-sub">Private to its owner.</p>
  <form class="pd-field" id="gate">
    <label for="pw" class="sr">Password</label>
    <input id="pw" type="password" autocomplete="current-password" autocapitalize="none" placeholder="Password" autofocus>
    <button type="submit" aria-label="Enter" disabled>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </button>
  </form>
  <p class="pd-gate-err" id="err" role="alert"></p>
  <p class="pd-gate-foot">TafsirLab</p>
</main>
<script>
(() => {
  const f = document.getElementById("gate"), pw = document.getElementById("pw"), b = f.querySelector("button"), err = document.getElementById("err");
  pw.addEventListener("input", () => { b.disabled = !pw.value.trim(); err.textContent = ""; f.removeAttribute("data-error"); });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pw.value.trim()) return;
    b.disabled = true;
    const r = await fetch("/api/productivity/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw.value }) }).catch(() => null);
    if (r && r.ok) { location.reload(); return; }
    const d = r ? await r.json().catch(() => null) : null;
    err.textContent = (d && d.error) || "Couldn’t reach TafsirLab. Check your connection.";
    f.setAttribute("data-error", "");
    b.disabled = false; pw.select();
  });
})();
</script>
</body>
</html>`;

const APP = (boot: string) => `${head("Productivity")}
<body class="pd">
<div class="app">
  <aside class="side">
    <header class="brand">
      <span class="mark" aria-hidden="true">T</span>
      <span class="brand-text"><b>Productivity</b><small>Tafsir Lab</small></span>
    </header>
    <div class="term">
      <span class="term-name">Half term</span>
      <span class="term-dates" id="term-dates"></span>
      <span class="term-status" id="term-status"></span>
    </div>
    <nav class="days" id="days" aria-label="Days"></nav>
    <section class="progress" id="progress" aria-label="Progress"></section>
  </aside>
  <main class="main">
    <header class="top">
      <div class="top-title">
        <h1 id="day-title"></h1>
        <p id="day-sub"></p>
      </div>
      <div class="top-actions">
        <div class="seg" role="tablist" aria-label="View">
          <button type="button" role="tab" data-view="day">Day</button>
          <button type="button" role="tab" data-view="week">Week</button>
        </div>
        <div class="nav-pair">
          <button type="button" class="icon-btn" id="prev" aria-label="Previous day"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <button type="button" class="icon-btn" id="next" aria-label="Next day"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
        </div>
        <button type="button" class="btn" id="today">Today</button>
        <button type="button" class="btn btn-primary" id="add"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add</button>
        <div class="menu-wrap">
          <button type="button" class="icon-btn" id="menu-btn" aria-label="More" aria-haspopup="menu" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
          <div class="menu" id="menu" role="menu" hidden>
            <button type="button" role="menuitem" data-act="print">Print this day</button>
            <button type="button" role="menuitem" data-act="export">Save a copy (JSON)</button>
            <button type="button" role="menuitem" data-act="import">Open a copy…</button>
            <hr>
            <button type="button" role="menuitem" data-act="reset" class="danger">Reset to the draft</button>
            <button type="button" role="menuitem" data-act="lock">Lock on this device</button>
          </div>
        </div>
      </div>
    </header>
    <div class="view" id="view"></div>
  </main>
  <aside class="inspector" id="inspector" aria-label="Details"></aside>
</div>
<div class="toast" id="toast" role="status" hidden></div>
<input type="file" id="import-file" accept="application/json,.json" hidden>
<script type="application/json" id="pd-boot">${boot}</script>
<script src="/productivity-app/app.js"></script>
</body>
</html>`;

const html = (body: string, status = 200) => new Response(body, {
  status,
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  },
});

export async function GET() {
  if (!(await hasAccess())) return html(GATE);

  const [row, session] = await Promise.all([
    db.productivityPlan.findUnique({ where: { id: PLAN_ID } }),
    getSessionOrNull(),
  ]);
  if (!row) return html(GATE, 404);

  // Your study workspaces, so a tafsīr block can open in the one you choose.
  const workspaces = session ? await db.workspace.findMany({
    where: { kind: "study", OR: [{ ownerId: session.userId }, { members: { some: { userId: session.userId } } }] },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  }) : [];

  const boot = JSON.stringify({
    draft: row.draft,
    state: row.state,
    updatedAt: row.updatedAt,
    workspaces,
    signedIn: !!session,
    sync: "/api/productivity/state",
    open: "/productivity/open/",
  }).replace(/</g, "\\u003c");   // nothing in the data can close the script tag
  return html(APP(boot));
}
