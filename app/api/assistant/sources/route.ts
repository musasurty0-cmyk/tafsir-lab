/**
 * GET /api/assistant/sources
 *   The editions the assistant can actually search — that is, the ones with
 *   embedded content, not the ones merely registered.
 *
 *   The difference matters: 120 sources exist in the database and only a
 *   fraction are ingested and indexed. Offering the rest in a picker would let
 *   someone pin a source that can never return anything, and then read the
 *   silence as "this scholar said nothing about that".
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { availableSources } from "@/lib/services/tafsir-search.service";
import { apiError } from "@/lib/api-errors";

export async function GET() {
  try {
    await getSession();
    const sources = await availableSources();
    return NextResponse.json({
      sources,
      // So the UI can say "nothing is indexed yet" rather than showing an
      // empty picker that looks broken.
      ready: sources.length > 0,
    });
  } catch (err) {
    return apiError(err);
  }
}
