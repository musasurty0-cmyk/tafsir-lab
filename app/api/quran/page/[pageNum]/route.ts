/**
 * GET /api/quran/page/[pageNum]
 *
 * Proxies the Quran Foundation API verses/by_page endpoint so the browser
 * never hits an external host directly (avoids any CORS issues) and the
 * response is cached server-side for 24 hours.
 *
 * Returns the raw API payload:
 *   { verses: QCFVerse[], meta: { ... } }
 *
 * Word fields requested: code_v2, text_qpc_hafs, v2_page, line_number
 * These are the minimum needed for QCF page-font rendering.
 */

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

const QF_BASE = "https://api.quran.com/api/v4";

async function _fetchQCFPage(pageNum: number) {
  const params = new URLSearchParams({
    language:    "en",
    words:       "true",
    translations: "20",
    word_fields: "code_v2,text_qpc_hafs,v2_page,line_number",
    per_page:    "50",   // pages have at most ~20 verses; 50 covers everything
    page:        "1",
  });

  const res = await fetch(`${QF_BASE}/verses/by_page/${pageNum}?${params}`, {
    next: { revalidate: 86400 },
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Quran API returned ${res.status} for page ${pageNum}`);
  }

  return res.json();
}

// Cache keyed by page number — Quran text is immutable.
const fetchQCFPageCached = unstable_cache(
  _fetchQCFPage,
  ["qcf-page"],
  { revalidate: 86400, tags: ["quran"] },
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageNum: string }> },
) {
  const { pageNum: raw } = await params;
  const pageNum = parseInt(raw, 10);

  if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
    return NextResponse.json({ error: "Page number must be 1–604" }, { status: 400 });
  }

  try {
    const data = await fetchQCFPageCached(pageNum);
    return NextResponse.json(data, {
      headers: {
        // Allow the browser to cache this response for 1 hour
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[qcf-page]", err);
    return NextResponse.json({ error: "Failed to fetch page data" }, { status: 502 });
  }
}
