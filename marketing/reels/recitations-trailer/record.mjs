/**
 * Record ONE continuous session of the app being used.
 *
 * The first cut of this trailer showed four still screenshots, each held for
 * seven or eight seconds. That is a slideshow of a product, not a product: the
 * same fault the Maryam reel had before it was rebuilt as one page that
 * scrolls. So there are no stills here. The app is driven for thirty seconds
 * straight -- scrolled, opened, filtered, played -- and the trailer's headlines
 * change OVER a surface that never stops moving.
 *
 * The script is timed against the trailer's beats, so each milestone lands
 * where its headline does:
 *
 *    0.0 - 7.2   the reciters, scrolling          (beat: "Every reciter you own")
 *    7.2 - 15.4  one reciter, scrolling by juz    (beat: "They file themselves by juz")
 *   15.4 - 23.2  the coverage wheel, being read   (beat: "All 114 surahs")
 *   23.2 - 30.2  play, dock, full player          (beat: "It just plays")
 *
 *   node record.mjs [http://localhost:5174]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "assets");
const URL = process.argv[2] || "http://localhost:5174";
const WEBM = path.join(OUT, "_session.webm");
const MP4 = path.join(OUT, "session.mp4");

const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find((c) => fs.existsSync(c));
if (!exe) { console.error("no chrome found"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const SEED = fs.readFileSync(path.join(HERE, "seed-library.js"), "utf8");

const browser = await puppeteer.launch({
  executablePath: exe, headless: "new",
  args: ["--autoplay-policy=no-user-gesture-required",
         "--force-prefers-reduced-motion=no-preference",
         "--hide-scrollbars"],
});

const t0 = () => Date.now();
let started = 0;
const at = async (s) => {                 // wait until s seconds into the take
  const target = started + s * 1000;
  const left = target - Date.now();
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  else if (left < -250) console.warn("  ! behind by " + (-left) + "ms at " + s + "s");
};

/* A real mouse click at the control's centre, not element.click(): the wheel's
   surahs are SVG nodes with role=button and no .click() method, and a genuine
   press is what the app's own handlers are written against anyway. */
async function tap(page, text) {
  const hit = await page.evaluate((t) => {
    const all = [...document.querySelectorAll("button, [role=button], a")];
    const el = all.find((e) => ((e.getAttribute("aria-label") || e.textContent || "").trim()).includes(t));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    el.scrollIntoView({ block: "nearest" });
    const r2 = el.getBoundingClientRect();
    return { label: (el.getAttribute("aria-label") || el.textContent || "").trim(),
             x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
  }, text);
  if (!hit) throw new Error("no visible control matching " + JSON.stringify(text));
  await page.mouse.click(hit.x, hit.y, { delay: 40 });
  return hit.label;
}

/** Scroll the page smoothly over `ms`, the way a thumb moves it. */
async function glide(page, dy, ms) {
  await page.evaluate(async (dy, ms) => {
    const el = document.scrollingElement || document.documentElement;
    const from = el.scrollTop, start = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        // ease-in-out: a thumb starts and stops, it does not run at one speed
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        el.scrollTop = from + dy * e;
        if (t < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  }, dy, ms);
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2,
                           isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

  await page.goto(URL, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  const seeded = await page.evaluate(SEED);
  console.log("seeded %d reciters, %d recordings", seeded.qaris, seeded.recordings);

  await page.goto(URL, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 3000));   // let the splash finish

  const cast = await page.screencast({ path: WEBM, fps: 30 });
  started = t0();
  console.log("recording...");

  // -- the reciters ------------------------------------------------------
  await at(1.4); await glide(page, 320, 2200);
  await at(4.6); await glide(page, -320, 1500);
  await at(6.9); console.log("  %s", await tap(page, "Open Abdul Basit Abdus Samad"));

  // -- one reciter, in mushaf order --------------------------------------
  await at(8.8);  await glide(page, 300, 2400);
  await at(12.2); await glide(page, 260, 2000);
  await at(14.9); await glide(page, -560, 1400);

  // -- the coverage wheel ------------------------------------------------
  await at(16.0); console.log("  %s", await tap(page, "Coverage"));
  await at(18.6); console.log("  %s", await tap(page, "36. Ya-Sin"));
  await at(20.8); await tap(page, "Clear surah filter").catch(() => {});
  await at(22.2); console.log("  %s", await tap(page, "Coverage"));

  // -- playing -----------------------------------------------------------
  await at(23.4); console.log("  %s", await tap(page, "Play Yusuf"));
  await at(24.8); console.log("  %s", await tap(page, "Open full screen player"));
  /* The player, and nothing else. Read-along was tried here and shows "no ayah
     timings are marked for this recording" -- true, and the wrong thing for a
     trailer to end on. The scrubber moving is motion enough. */
  await at(27.6); await glide(page, 180, 1600);
  await at(30.2);

  await cast.stop();
  console.log("recorded " + ((Date.now() - started) / 1000).toFixed(1) + "s");

  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", WEBM,
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-an", MP4], { stdio: "inherit" });
  fs.unlinkSync(WEBM);
  const { size } = fs.statSync(MP4);
  console.log("%s  (%d KB)", path.relative(process.cwd(), MP4), Math.round(size / 1024));
} finally {
  await browser.close();
}
