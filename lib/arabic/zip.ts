/**
 * Read the text files out of a .zip in the browser.
 *
 * Just enough of the format for a folder of flashcard decks: the central
 * directory for names and offsets, then each entry stored or deflated. The
 * browser's own DecompressionStream does the inflating, so there is no
 * library to ship and the zip never leaves the device — only the parsed
 * cards are sent.
 */

export interface ZipText { path: string; text: string }

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipTexts(
  buf: ArrayBuffer,
  wanted: (path: string) => boolean = (p) => /\.txt$/i.test(p),
): Promise<ZipText[]> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const utf8 = new TextDecoder("utf-8");

  // The end record sits in the last 64 KB + 22 bytes (its comment can be up to 64 KB).
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("That file isn't a zip.");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: ZipText[] = [];

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new Error("The zip's index is damaged.");
    const method   = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen  = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const noteLen  = view.getUint16(p + 32, true);
    const local    = view.getUint32(p + 42, true);
    const path     = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + noteLen;

    if (path.endsWith("/") || !wanted(path)) continue;
    if (view.getUint32(local, true) !== LOCAL) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compSize);

    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflate(raw);
    else continue; // anything else is not something a course export produces

    out.push({ path, text: utf8.decode(data) });
  }
  return out;
}
