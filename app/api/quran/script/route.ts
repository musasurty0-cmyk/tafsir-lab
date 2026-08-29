/**
 * GET /api/quran/script?surah=<n>&script=<id>
 *   A sūrah's verses in one of the mushaf scripts.
 *
 * Proxied so the response can be cached and shared between users — the Qurʾān
 * text does not change, so a chapter fetched once serves everyone — and so the
 * shape stays ours if the upstream field names move.
 *
 * Tajweed comes back as markup ("<tajweed class=ikhafa>…</tajweed>"). It is
 * parsed into plain segments HERE rather than passed through, so nothing from
 * upstream can reach the DOM as HTML. The client renders segments, never
 * innerHTML.
 */

import { NextRequest, NextResponse } from "next/server";

const API = "https://api.quran.com/api/v4/quran/verses";

export const SCRIPTS = [
  { id: "uthmani", label: "Uthmani",        note: "Standard Madīnah script" },
  { id: "indopak", label: "Indo-Pak",       note: "South Asian script style" },
  { id: "tajweed", label: "Tajweed Colours", note: "Colour-coded recitation rules" },
  { id: "imlaei",  label: "Simple",          note: "Plain modern spelling" },
] as const;

export type ScriptId = typeof SCRIPTS[number]["id"];

/** Upstream path and field for each of ours. */
const UPSTREAM: Record<ScriptId, { path: string; field: string }> = {
  uthmani: { path: "uthmani",         field: "text_uthmani" },
  indopak: { path: "indopak",         field: "text_indopak" },
  tajweed: { path: "uthmani_tajweed", field: "text_uthmani_tajweed" },
  imlaei:  { path: "imlaei",          field: "text_imlaei" },
};

export interface Segment { text: string; rule?: string }
export interface ScriptVerse { verseKey: string; segments: Segment[] }

/** Only rules the client has a colour for; anything else renders unstyled. */
const KNOWN_RULES = new Set([
  "ham_wasl", "madda_normal", "madda_permissible", "madda_obligatory", "madda_necessary",
  "ikhafa", "ikhafa_shafawi", "idgham_ghunnah", "idgham_wo_ghunnah", "idgham_shafawi",
  "idgham_mutajanisayn", "idgham_mutamathilayn", "ghunnah", "qalaqah", "iqlab",
  "laam_shamsiyah", "slnt", "end",
]);

/**
 * Split tajweed markup into segments.
 *
 * A hand-rolled scan rather than a regex-replace into HTML: the point is that
 * the output is DATA, so a malformed or hostile upstream string can only ever
 * become text. Unclosed or unknown tags degrade to plain text rather than
 * throwing away the verse.
 */
export function parseTajweed(src: string): Segment[] {
  const out: Segment[] = [];
  const re = /<tajweed\s+class=([a-z_]+)\s*>([\s\S]*?)<\/tajweed>/g;
  let last = 0, m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    const rule = KNOWN_RULES.has(m[1]) ? m[1] : undefined;
    if (m[2]) out.push({ text: m[2], rule });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ text: src.slice(last) });

  // Any stray angle brackets from a tag we could not pair off would render as
  // literal "<tajweed…" — strip them so a parse failure degrades to clean text.
  return out
    .map((s) => ({ ...s, text: s.text.replace(/<\/?[a-z][^>]*>/gi, "") }))
    .filter((s) => s.text.length > 0);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  const surah = Number(q.get("surah"));
  if (!Number.isInteger(surah) || surah < 1 || surah > 114)
    return NextResponse.json({ error: "surah must be 1-114" }, { status: 400 });

  const raw = q.get("script") ?? "uthmani";
  const script = (SCRIPTS.some((s) => s.id === raw) ? raw : "uthmani") as ScriptId;
  const { path, field } = UPSTREAM[script];

  try {
    const res = await fetch(`${API}/${path}?chapter_number=${surah}`,
      { next: { revalidate: 86400, tags: ["quran"] } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const data = await res.json() as { verses?: Record<string, string>[] };
    const verses: ScriptVerse[] = (data.verses ?? []).map((v) => {
      const text = String(v[field] ?? "");
      return {
        verseKey: String(v.verse_key ?? ""),
        segments: script === "tajweed" ? parseTajweed(text) : [{ text }],
      };
    });

    return NextResponse.json({ script, surah, verses, scripts: SCRIPTS });
  } catch {
    return NextResponse.json({ error: "Could not load that script" }, { status: 502 });
  }
}
