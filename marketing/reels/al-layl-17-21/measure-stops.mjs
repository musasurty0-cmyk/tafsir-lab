/**
 * Measure where each āyah block actually sits, with the real fonts loaded.
 *
 * WHY THIS EXISTS. The page used to measure itself, inline, at parse time —
 * and at parse time the Google fonts have not arrived, so `display=swap` is
 * still showing fallbacks. Scheherazade New is considerably taller than the
 * fallback serif at line-height 2.0, so every block grew after the swap and
 * every scroll stop was left sitting low; at the larger caption size that put
 * the last line of the longer translations under the bottom fade.
 *
 * So the stops are measured here, once, in the same engine that renders the
 * video, AFTER `document.fonts.ready` — and baked into the page as literals.
 * The composition then has no runtime layout dependency at all.
 *
 * Run by build.py. Prints one JSON object on stdout.
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const html = path.resolve(process.argv[2]);
const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find((c) => fs.existsSync(c));
if (!exe) { console.error("no chrome found"); process.exit(2); }

const b = await puppeteer.launch({ executablePath: exe, headless: "new" });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  await p.goto(pathToFileURL(html).href, { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready);
  // The webfont swap reflows the column; one more frame settles it.
  await new Promise((r) => setTimeout(r, 400));
  const out = await p.evaluate(() => {
    const v = document.querySelector(".viewport");
    const rows = [];
    document.querySelectorAll(".aya").forEach((el) => {
      const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      rows.push({ id: el.id, top: el.offsetTop, content: el.offsetHeight - pad });
    });
    return { vpH: v.offsetHeight, rows };
  });
  console.log(JSON.stringify(out));
} finally {
  await b.close();
}
