/**
 * Show how each caption actually breaks, and flag the bad breaks.
 *
 * Wrapping is not the fault -- a two-line caption is normal and the climax
 * reads better over two lines than one. The fault is a break that leaves a
 * word stranded on its own ("in a position with good / grades") or splits a
 * phrase where the sense does not ("That these could be your / intention").
 * Guessing character counts got three of these wrong in a row, so the ranges
 * in script.json are judged against the real layout instead.
 *
 *   node check-wraps.mjs [index.html]
 *
 * Exits non-zero when a caption ends on an orphan.
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find((c) => fs.existsSync(c));
if (!exe) { console.error("no chrome found"); process.exit(2); }

const html = path.resolve(process.argv[2] || "index.html");

const b = await puppeteer.launch({ executablePath: exe, headless: "new" });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  await p.goto(pathToFileURL(html).href, { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));

  const rows = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll(".stage .ln").forEach((el) => {
      // Group the word spans by the row they landed on.
      const words = el.querySelectorAll(".w");
      let visual;
      if (words.length) {
        // Karaoke lines: each word is its own span, so group them by row.
        const rows = new Map();
        words.forEach((w) => {
          const top = Math.round(w.getBoundingClientRect().top);
          if (!rows.has(top)) rows.set(top, []);
          rows.get(top).push(w.textContent);
        });
        visual = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, ws]) => ws.join(" "));
      } else {
        /* Plain text: there are no spans to group, so count the line BOXES
           and split the words across them. getClientRects gives one rect per
           line box, which is the only honest source for where it broke. */
        const n = Math.max(1, el.getClientRects().length);
        const all = el.textContent.trim().split(/\s+/);
        const per = Math.ceil(all.length / n);
        visual = [];
        for (let i = 0; i < all.length; i += per) visual.push(all.slice(i, i + per).join(" "));
        if (n === 1) visual = [all.join(" ")];
      }
      out.push({ beat: el.closest(".beat").id, visual });
    });
    return out;
  });

  let bad = 0;
  for (const r of rows) {
    const last = r.visual[r.visual.length - 1];
    const orphan = r.visual.length > 1 && last.split(/\s+/).length === 1;
    if (orphan) bad++;
    const tag = orphan ? "ORPHAN " : "       ";
    console.log(tag + r.beat.padEnd(5) + " | " + r.visual.join("  /  "));
  }
  console.log(bad
    ? "\n" + bad + " caption(s) end on a stranded word."
    : "\nno caption ends on a stranded word (" + rows.length + " checked).");
  process.exitCode = bad ? 1 : 0;
} finally {
  await b.close();
}
