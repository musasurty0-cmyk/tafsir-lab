/**
 * capture-product.mjs — captures REAL TafsirLab screens for the marketing reels.
 *
 * Drives the already-installed Chrome via puppeteer-core (no bundled browser),
 * signs in with demo mode, seeds clean/realistic demo content through the app's
 * own API, then screenshots each product surface at deviceScaleFactor 2 so the
 * UI stays crisp when scaled inside a 1080x1920 device frame.
 *
 * Usage:  node marketing/reels/shared/capture-product.mjs [--base http://localhost:3000]
 * Output: marketing/reels/tafsirlab-intro/assets/capture/<name>.png  (+ manifest.json)
 *
 * Requires the dev server to already be running (see marketing/reels/README.md).
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../tafsirlab-intro/assets/capture");

const argOf = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = argOf("base", "http://localhost:3000").replace(/\/$/, "");
const DEMO_CODE = argOf("code", "1653");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No Chrome found. Set CHROME_PATH env var.");
  process.exit(1);
}

/** Viewports — desktop/tablet get the screen time, phone is availability only. */
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  tablet: { width: 1194, height: 834, deviceScaleFactor: 2 }, // iPad landscape
  mobile: { width: 390, height: 844, deviceScaleFactor: 3 },
};

const log = (...a) => console.log("[capture]", ...a);

/** Run fetch inside the page so the session cookie is applied automatically. */
const api = (page, path, body, method = "POST") =>
  page.evaluate(
    async (p, b, m) => {
      const r = await fetch(p, {
        method: m,
        headers: { "Content-Type": "application/json" },
        ...(b ? { body: JSON.stringify(b) } : {}),
      });
      const text = await r.text();
      try { return { status: r.status, json: JSON.parse(text) }; }
      catch { return { status: r.status, text: text.slice(0, 200) }; }
    },
    path, body ?? null, method,
  );

async function shoot(page, name, { full = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const path = resolve(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: full });
  const vp = page.viewport();
  log(`shot ${name}.png  (${vp.width}x${vp.height} @${vp.deviceScaleFactor}x)`);
  return { name, file: `${name}.png`, width: vp.width, height: vp.height, dpr: vp.deviceScaleFactor };
}

/** Hide anything that reads as test/debug chrome in a marketing capture. */
async function polish(page) {
  await page.addStyleTag({
    content: `
      /* Phase 8: no loading flashes, no debug/build chrome in captures */
      .login-build, [data-testid], .pdf-pages-loading { display: none !important; }
      /* Next.js dev-only overlay ("N  3 Issues") must never reach marketing */
      nextjs-portal, #__next-build-watcher, [data-nextjs-toast],
      [data-nextjs-dialog-overlay], .nextjs-toast { display: none !important; }
      /* "Offline" live-sync pill — an artifact of the capture box, not the product */
      .live-pill[data-status="disconnected"], .live-pill[data-status="connecting"] { display: none !important; }
      *, *::before, *::after {
        animation-play-state: paused !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    `,
  });
}

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log(`chrome: ${chromePath}`);
  log(`base:   ${BASE}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "shell",
    args: ["--hide-scrollbars", "--force-device-scale-factor=1", "--font-render-hinting=none"],
  });
  const manifest = [];
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS.desktop);

  // ── Landing (real marketing site) ───────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await polish(page); await settle();
  manifest.push(await shoot(page, "landing-desktop"));

  // ── Auth: demo mode, then seed content through the real API ─────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  const demo = await api(page, "/api/auth/demo", { code: DEMO_CODE });
  if (demo.status !== 201 && demo.status !== 200) {
    throw new Error(`demo auth failed: ${demo.status} ${JSON.stringify(demo.json ?? demo.text)}`);
  }
  log("demo session established");

  // A representative, publicly-safe study workspace.
  const ws = (await api(page, "/api/workspaces", {
    name: "Tafsir Circle", type: "private", kind: "study",
  })).json?.workspace;
  if (!ws?.id) throw new Error("workspace creation failed");
  log(`workspace ${ws.id}`);

  // Surah 2 (Al-Baqarah) — the Mushaf surface the reel is built around.
  const surahRes = await api(page, `/api/workspaces/${ws.id}/surahs`, { surahNumber: 2 });
  log(`surah seed -> ${surahRes.status}`);

  // A surah with no page shows the "No pages yet" empty state — never usable
  // for marketing. Create the study page, then capture the page itself.
  const pageRes = await api(page, `/api/workspaces/${ws.id}/surahs/2/pages`, { title: "Al-Baqarah 1–5" });
  const studyPage = pageRes.json?.page ?? pageRes.json;
  if (!studyPage?.id) throw new Error(`page creation failed: ${JSON.stringify(pageRes).slice(0, 300)}`);
  log(`study page ${studyPage.id}`);

  // Realistic, publicly-safe study notes (Phase 8: no test data / lorem).
  const doc = (text) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const notes = [
    // Word-level note — the differentiator Scene 3 is built on.
    { noteType: "linguistic", anchorType: "word", surahNumber: 2, ayahNumber: 2, wordPosition: 2,
      content: doc("رَيْب — doubt that unsettles. The ayah negates it entirely: no doubt whatsoever.") },
    // Ayah-level reflection.
    { noteType: "thematic", anchorType: "ayah", surahNumber: 2, ayahNumber: 2,
      content: doc("Guidance is promised specifically to those who already carry taqwā.") },
    { noteType: "question", anchorType: "ayah", surahNumber: 2, ayahNumber: 3,
      content: doc("Why is belief in the unseen listed before establishing prayer?") },
  ];
  for (const n of notes) {
    const r = await api(page, `/api/pages/${studyPage.id}/notes`, n);
    log(`note ${n.anchorType}/${n.noteType} -> ${r.status}`);
  }

  const pageUrl = `${BASE}/workspaces/${ws.id}/surahs/2/pages/${studyPage.id}`;

  // ── Workspace home / surah grid ─────────────────────────────────────────
  await page.goto(`${BASE}/workspaces/${ws.id}`, { waitUntil: "networkidle2" });
  await polish(page); await settle(1200);
  manifest.push(await shoot(page, "workspace-home-desktop"));

  // ── Mushaf canvas (the hero surface) ────────────────────────────────────
  // The page opens in Editor mode; the Mushaf lives in Canvas mode, reachable
  // via the ?mode= deep link (WorkspacePageView reads it on mount).
  const mushafUrl = `${pageUrl}?mode=canvas`;

  /** Wait for real Mushaf verse content — never capture a loading state. */
  async function waitForMushaf(p) {
    try {
      await p.waitForFunction(
        () => {
          const el = document.querySelector(".qcf-line, .qcf-page, .mushaf-panel, [class*='qcf']");
          return !!el && el.textContent && el.textContent.trim().length > 0;
        },
        { timeout: 25000 },
      );
    } catch { log("WARN: Mushaf verse selector never appeared — check the capture"); }
    await settle(1800); // fonts + line layout settle
  }

  await page.goto(mushafUrl, { waitUntil: "networkidle2" });
  await polish(page);
  await waitForMushaf(page);
  manifest.push(await shoot(page, "mushaf-desktop"));

  // Tablet framing of the same context (strongest annotation device).
  await page.setViewport(VIEWPORTS.tablet);
  await page.goto(mushafUrl, { waitUntil: "networkidle2" });
  await polish(page); await waitForMushaf(page);
  manifest.push(await shoot(page, "mushaf-tablet"));

  // Mobile — access/review only, deliberately not the hero.
  await page.setViewport(VIEWPORTS.mobile);
  await page.goto(mushafUrl, { waitUntil: "networkidle2" });
  await polish(page); await waitForMushaf(page);
  manifest.push(await shoot(page, "mushaf-mobile"));

  // ── Split view: Mushaf + notes side by side (Scene 5 deep study) ────────
  await page.setViewport(VIEWPORTS.desktop);
  await page.goto(`${pageUrl}?mode=split`, { waitUntil: "networkidle2" });
  await polish(page); await waitForMushaf(page);
  manifest.push(await shoot(page, "split-desktop"));

  // ── Editor mode with real typed study content (Scene 4) ─────────────────
  await page.goto(`${pageUrl}?mode=editor`, { waitUntil: "networkidle2" });
  await settle(1600);
  // Type into the real TipTap editor so the capture shows genuine rich text
  // rather than the empty "/" placeholder.
  try {
    const pm = await page.waitForSelector(".ProseMirror", { timeout: 12000 });
    await pm.click();
    await settle(300);
    await page.keyboard.type("Alif Lām Mīm", { delay: 12 });
    await page.keyboard.press("Enter");
    await page.keyboard.type("The opening letters — recited, not translated. Scholars pause here with humility.", { delay: 6 });
    await page.keyboard.press("Enter");
    await page.keyboard.type("Guidance is described as already present in the Book, waiting on taqwā.", { delay: 6 });
    await settle(900);
  } catch (e) { log(`editor typing skipped: ${e.message.split("\n")[0]}`); }
  await polish(page); await settle(500);
  manifest.push(await shoot(page, "editor-desktop"));

  // ── Notes review (cross-page study rollup) ──────────────────────────────
  await page.goto(`${BASE}/workspaces/${ws.id}/notes`, { waitUntil: "networkidle2" });
  await polish(page); await settle(1400);
  manifest.push(await shoot(page, "notes-review-desktop"));

  // ── Boards entry surface. This route may redirect to a freshly created
  //    board, so tolerate the navigation instead of failing the whole run.
  try {
    await page.goto(`${BASE}/workspaces/${ws.id}/whiteboard`, { waitUntil: "networkidle2" });
    await settle(1500);
    await polish(page); await settle(600);
    manifest.push(await shoot(page, "boards-desktop"));
  } catch (e) {
    log(`boards capture skipped: ${e.message.split("\n")[0]}`);
  }

  writeFileSync(
    resolve(OUT, "manifest.json"),
    JSON.stringify({ base: BASE, workspaceId: ws.id, capturedAt: new Date().toISOString(), shots: manifest }, null, 2),
  );
  log(`manifest written — ${manifest.length} shots -> ${OUT}`);
  await browser.close();
}

main().catch((e) => { console.error("[capture] FAILED:", e.message); process.exit(1); });
