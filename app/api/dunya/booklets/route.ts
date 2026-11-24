/**
 * PATCH /api/dunya/booklets   { id, field, value } → { ok }
 *
 * One mark on a Maths question booklet: done (true or false), or how confident
 * it felt (red, amber, green, or null to clear). Written by a single UPDATE, as
 * in ../spec/route.ts, so two quick taps never overwrite each other; the same
 * statement checks the booklet is in the catalogue. Behind the Dunya password.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/dunya/gate";
import { SPEC_FIELDS } from "@/lib/dunya/maths-spec";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PATCH(req: NextRequest) {
  if (!(await hasAccess())) return bad("Locked", 401);
  const body = await req.json().catch(() => null) as { id?: unknown; field?: unknown; value?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const field = body?.field;
  const value = body?.value ?? null;
  const valid =
    field === "done" ? typeof value === "boolean"
    : field === "confidence" ? value === null || (SPEC_FIELDS.confidence as readonly unknown[]).includes(value)
    : false;
  if (!id || !valid) return bad("Not a valid mark");

  const mark = JSON.stringify({ [field as string]: value });
  const n = await db.$executeRaw`
    UPDATE "DunyaPlan"
       SET spec = jsonb_set(
             spec, '{booklets}',
             coalesce(spec->'booklets', '{}'::jsonb) || jsonb_build_object(
               ${id}::text,
               coalesce(spec->'booklets'->${id}::text, '{}'::jsonb) || ${mark}::jsonb
             ),
             true)
     WHERE id = ${PLAN_ID}
       AND catalog->'booklets' @> jsonb_build_array(jsonb_build_object('id', ${id}::text))`;
  if (!n) return bad("No such booklet", 404);
  return NextResponse.json({ ok: true });
}
