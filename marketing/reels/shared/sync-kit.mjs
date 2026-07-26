/**
 * sync-kit.mjs — copies the canonical reel kit into each reel project.
 *
 * The kit lives once in marketing/reels/shared/kit/ so every reel shares one
 * design system. HyperFrames serves each reel project as its own root, so a
 * composition can't reference `../shared/...`; each project therefore keeps a
 * synced copy at `<project>/kit/`. Same pattern as scripts/copy-mupdf-wasm.mjs.
 *
 * Usage: node marketing/reels/shared/sync-kit.mjs [reel-name ...]
 *        (no args = sync every reel project found)
 */
import { copyFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REELS = resolve(HERE, "..");
const KIT = join(HERE, "kit");

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(REELS).filter((d) => {
      const p = join(REELS, d);
      return d !== "shared" && statSync(p).isDirectory() && existsSync(join(p, "hyperframes.json"));
    });

if (!targets.length) {
  console.log("[sync-kit] no reel projects found");
  process.exit(0);
}

for (const name of targets) {
  const dest = join(REELS, name, "kit");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(KIT)) copyFileSync(join(KIT, f), join(dest, f));
  console.log(`[sync-kit] ${name}/kit  <-  shared/kit  (${readdirSync(KIT).join(", ")})`);
}
