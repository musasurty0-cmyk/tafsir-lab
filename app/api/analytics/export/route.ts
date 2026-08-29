/**
 * GET /api/analytics/export
 *   Every annotation the signed-in user owns, as a Markdown file.
 *
 *   Markdown rather than JSON because the point of an export is to be readable
 *   somewhere that is not this app — pasted into a document, kept in a folder,
 *   read in ten years. ?format=json returns the raw rows for anyone who wants
 *   to move the data rather than read it.
 *
 *   Bodies go through the same serializer as a page export, so bold, lists and
 *   embedded āyah blocks survive instead of being flattened to bare text.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as Analytics from "@/lib/services/analytics.service";
import { noteToMarkdown } from "@/lib/export-markdown";
import { fetchChapters } from "@/lib/quran-api";
import { apiError } from "@/lib/api-errors";

function where(r: {
  surahNumber: number | null; ayahNumber: number | null;
  wordPosition: number | null; mushafPage: number | null;
}) {
  if (r.surahNumber != null && r.ayahNumber != null) {
    const w = r.wordPosition != null ? ` · word ${r.wordPosition}` : "";
    return `${r.surahNumber}:${r.ayahNumber}${w}`;
  }
  if (r.surahNumber != null) return `Sūrah ${r.surahNumber}`;
  if (r.mushafPage != null && r.mushafPage > 0) return `Page ${r.mushafPage}`;
  return "Unplaced";
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const rows = await Analytics.exportRows(userId);

    if (req.nextUrl.searchParams.get("format") === "json") {
      return NextResponse.json({ count: rows.length, rows });
    }

    // Names are nice-to-have: a failed chapter fetch must not cost the user
    // their export, so fall back to bare numbers rather than throwing.
    const names = new Map<number, string>();
    try {
      for (const ch of await fetchChapters()) names.set(ch.id, ch.name_simple);
    } catch { /* numbers only */ }

    const stamp = new Date().toISOString().slice(0, 10);
    const out: string[] = [
      `# Annotations`, ``,
      `Exported ${stamp} · ${rows.length} annotation${rows.length === 1 ? "" : "s"}`, ``,
    ];

    let surah: number | null | undefined = undefined;
    for (const r of rows) {
      if (r.surahNumber !== surah) {
        surah = r.surahNumber;
        const name = surah != null ? names.get(surah) : null;
        out.push(``, `## ${surah != null ? `${surah}. ${name ?? "Sūrah"}` : "Not tied to a sūrah"}`, ``);
      }
      const body = noteToMarkdown(r.content);
      const src  = r.page?.workspaceSurah?.workspace?.name;
      out.push(
        `**${where(r)}** — *${r.noteType}* · ${r.createdAt.toISOString().slice(0, 10)}` +
        (src ? ` · ${src}` : ""),
      );
      out.push(body
        ? body.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n")
        : `> _(empty)_`);
      out.push(``);
    }

    return new NextResponse(out.join("\n"), {
      headers: {
        "Content-Type":        "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="annotations-${stamp}.md"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
