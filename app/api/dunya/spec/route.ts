/**
 * PATCH /api/dunya/spec   { topicId, field, value } → { ok }
 *
 * One mark on the Maths spec tracker: whether a part has been covered in a
 * lesson (red, amber, green), whether its questions are done (red, green), or
 * how confident it feels (red, amber, green, or null to clear). One field per
 * request, written by a single UPDATE so two quick taps, or two devices, never
 * overwrite each other. Behind the Dunya password.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/dunya/gate";
import { SPEC_FIELDS, SPEC_IDS, type SpecField } from "@/lib/dunya/maths-spec";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PATCH(req: NextRequest) {
  if (!(await hasAccess())) return bad("Locked", 401);
  const body = await req.json().catch(() => null) as { topicId?: unknown; field?: unknown; value?: unknown } | null;
  const topicId = typeof body?.topicId === "string" ? body.topicId : "";
  const field = body?.field as SpecField;
  if (!SPEC_IDS.has(topicId)) return bad("No such topic");
  if (!(field in SPEC_FIELDS)) return bad("No such mark");
  const value = body?.value ?? null;
  const allowed = SPEC_FIELDS[field] as readonly string[];
  if (!(value === null ? field === "confidence" : typeof value === "string" && allowed.includes(value))) return bad("Not a valid mark");

  const n = await db.$executeRaw`
    UPDATE "DunyaPlan"
       SET spec = jsonb_set(
             spec, '{topics}',
             coalesce(spec->'topics', '{}'::jsonb) || jsonb_build_object(
               ${topicId}::text,
               coalesce(spec->'topics'->${topicId}::text, '{}'::jsonb)
                 || jsonb_build_object(${field}::text, to_jsonb(${value}::text))
             ),
             true)
     WHERE id = ${PLAN_ID}`;
  if (!n) return bad("Not set up", 404);
  return NextResponse.json({ ok: true });
}
