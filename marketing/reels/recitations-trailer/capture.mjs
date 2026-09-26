/**
 * Capture the Recitations app's real screens for the trailer.
 *
 * Drives the app in a headless Chrome at phone size with deviceScaleFactor 3,
 * so a 390x844 screen comes out 1170x2532 -- more than enough to sit in a
 * 1080-wide frame without resampling artefacts.
 *
 * The library is SEEDED first, straight into IndexedDB. The app reads every
 * recording's metadata on boot and only touches the audio store on playback,
 * so a short silent wav per recording is enough to make the archive real. None
 * of this touches the user's own browser profile.
 *
 *   node capture.mjs [http://localhost:5174]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "assets");
const URL = process.argv[2] || "http://localhost:5174";

const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find((c) => fs.existsSync(c));
if (!exe) { console.error("no chrome found"); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });

const AYAHS = [0, 7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18,
  12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
  30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

const QARIS = [["q1", "Abdul Basit Abdus Samad"], ["q2", "Mahmoud Khalil Al-Husary"],
  ["q3", "Mishary Rashid Alafasy"], ["q4", "Muhammad Siddiq Al-Minshawi"], ["q5", "Saad Al-Ghamdi"]];
const RECS = [
  ["q1", 1, 1, 2, 141, 47, "Juz 1 \u2014 Cairo, 1961"], ["q1", 12, 1, 12, 111, 38, "Surat Yusuf, complete"],
  ["q1", 19, 1, 19, 98, 21, ""], ["q1", 55, 1, 56, 96, 26, "Ar-Rahman and Al-Waqiah"],
  ["q2", 2, 142, 2, 252, 44, "Juz 2"], ["q2", 18, 1, 18, 110, 33, "Al-Kahf \u2014 Friday"],
  ["q2", 36, 1, 36, 83, 16, ""], ["q3", 67, 1, 70, 44, 18, "Tabarak to Al-Maarij"],
  ["q3", 78, 1, 84, 25, 24, "Juz Amma, first half"], ["q3", 85, 1, 114, 6, 29, "Juz Amma, second half"],
  ["q4", 3, 1, 3, 200, 52, "Ali 'Imran, complete"], ["q4", 17, 1, 17, 111, 28, "Al-Isra"],
  ["q4", 39, 1, 41, 54, 41, ""], ["q5", 4, 1, 4, 176, 55, "An-Nisa"],
  ["q5", 7, 1, 7, 206, 49, "Al-A'raf"], ["q5", 29, 1, 33, 73, 46, "Juz 21"]];

const browser = await puppeteer.launch({
  executablePath: exe, headless: "new",
  args: ["--autoplay-policy=no-user-gesture-required", "--force-prefers-reduced-motion=no-preference"],
});

const shots = [];
async function shoot(page, name) {
  const file = path.join(OUT, name + ".png");
  await page.screenshot({ path: file });
  const { size } = fs.statSync(file);
  shots.push(name);
  console.log("  %s  (%d KB)", name.padEnd(22), Math.round(size / 1024));
}

/** Click the first element whose accessible name or text matches. */
async function tap(page, text, { exact = false } = {}) {
  const ok = await page.evaluate((t, ex) => {
    const all = [...document.querySelectorAll("button, [role=button], a")];
    const hit = all.find((e) => {
      const s = (e.getAttribute("aria-label") || e.textContent || "").trim();
      return ex ? s === t : s.includes(t);
    });
    if (!hit) return false;
    hit.click();
    return true;
  }, text, exact);
  if (!ok) throw new Error("no control matching " + JSON.stringify(text));
  await new Promise((r) => setTimeout(r, 700));
}

/** Click the first control whose accessible name matches a pattern. */
async function tapMatch(page, re) {
  const hit = await page.evaluate((src, flags) => {
    const rx = new RegExp(src, flags);
    const all = [...document.querySelectorAll("button, [role=button], a")];
    const el = all.find((e) => rx.test((e.getAttribute("aria-label") || e.textContent || "").trim()));
    if (!el) return null;
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
    el.click();
    return label;
  }, re.source, re.flags);
  if (!hit) throw new Error("no control matching " + re);
  console.log("    tapped: %s", hit);
  await new Promise((r) => setTimeout(r, 700));
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true,
                           hasTouch: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

  // Boot once to create the database, seed it, then reload into a full library.
  await page.goto(URL, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));
  const seeded = await page.evaluate(async (AYAHS, QARIS, RECS) => {
    const toAbs = (s, a) => { let n = 0; for (let i = 1; i < s; i++) n += AYAHS[i]; return n + a; };
    const db = await new Promise((res, rej) => {
      const rq = indexedDB.open("majlis", 1);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
    const sr = 8000, secs = 2, n = sr * secs, buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    const blob = new Blob([buf], { type: "audio/wav" });

    const now = Date.now();
    const tx = db.transaction(["qaris", "recordings", "audio"], "readwrite");
    const qs = tx.objectStore("qaris"), rs = tx.objectStore("recordings"), as = tx.objectStore("audio");
    QARIS.forEach(([id, name], i) => qs.put({ id, name, createdAt: now - (QARIS.length - i) * 864e5 }));
    RECS.forEach((r, i) => {
      const [qariId, s0, a0, s1, a1, mins, note] = r, id = "r" + (i + 1);
      rs.put({ id, qariId, startSurah: s0, startAyah: a0, endSurah: s1, endAyah: a1,
        startAbsolute: toAbs(s0, a0),
        fileName: (note || "recitation").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".mp3",
        mimeType: "audio/mpeg", size: Math.round(mins * 60 * 16000), duration: mins * 60,
        note: note || undefined, createdAt: now - (RECS.length - i) * 36e5 });
      as.put(blob, id);          // out-of-line key: the audio store has no keyPath
    });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return { qaris: QARIS.length, recordings: RECS.length };
  }, AYAHS, QARIS, RECS);
  console.log("seeded %d reciters, %d recordings\n", seeded.qaris, seeded.recordings);

  const settle = async (ms = 1800) => { await new Promise((r) => setTimeout(r, ms)); };

  await page.goto(URL, { waitUntil: "networkidle0" });
  await settle(2600);                       // the splash plays on every boot
  await shoot(page, "01-home");

  await tap(page, "Open Abdul Basit Abdus Samad");
  await settle(900);
  await shoot(page, "02-qari");

  await tap(page, "Coverage");              // the wheel is collapsed at phone width
  await settle(900);
  await shoot(page, "03-wheel");

  await tap(page, "Coverage");              // shut it again before playing
  await settle(500);
  /* Inside a qari the play controls belong to individual recordings and are
     labelled "Play <title>", so match the prefix rather than a fixed name. */
  await tapMatch(page, /^Play /);
  await settle(1500);
  await shoot(page, "04-dock");

  await tap(page, "Open full screen player");
  await settle(1200);
  await shoot(page, "05-nowplaying");

  console.log("\n%d screens -> %s", shots.length, path.relative(process.cwd(), OUT));
} finally {
  await browser.close();
}
