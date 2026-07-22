// Copies MuPDF's WASM binary into /public so the browser can fetch it from a
// stable URL (/mupdf/mupdf-wasm.wasm). PdfPages sets an Emscripten `locateFile`
// pointing there, because the bundler's default (`new URL(..., import.meta.url)`)
// resolves to a hashed chunk directory where the binary isn't served.
//
// Runs on postinstall so the copy always matches the installed mupdf version
// (and Vercel gets it during `npm install` — the file is gitignored).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src  = join(root, "node_modules", "mupdf", "dist", "mupdf-wasm.wasm");
const dest = join(root, "public", "mupdf", "mupdf-wasm.wasm");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("[mupdf] copied mupdf-wasm.wasm -> public/mupdf/");
