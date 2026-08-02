import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  createConnection, listForObject, listCatalogue, ConnectionError,
} from "@/lib/services/connections.service";
import type { ObjectType } from "@/lib/quran-objects";

function errStatus(e: unknown): number {
  if (e instanceof ConnectionError) {
    return e.code === "NOT_FOUND" ? 404
         : e.code === "FORBIDDEN" ? 403
         : e.code === "DUPLICATE" ? 409
         : 400;
  }
  const s = String(e);
  if (/Not authenticated|Invalid or expired session|Malformed session/.test(s)) return 401;
  if (s.includes("FORBIDDEN") || s.includes("not a member")) return 403;
  if (s.includes("NOT_FOUND") || s.includes("not found"))    return 404;
  return 500;
}

/**
 * ?object=<key>  → every Connection touching that object (either end)
 * otherwise      → the paginated workspace catalogue
 *
 * Split so a study panel never pays for the whole workspace graph just to show
 * the handful of Connections on one verse.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const sp = new URL(req.url).searchParams;

    const objectKey = sp.get("object");
    if (objectKey) {
      const connections = await listForObject(workspaceId, userId, objectKey);
      return NextResponse.json({ connections });
    }

    const res = await listCatalogue(workspaceId, userId, {
      q:        sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      type:     (sp.get("type") as ObjectType) ?? undefined,
      sort:     (sp.get("sort") as "updated" | "created" | "name" | "quran") ?? undefined,
      take:     sp.get("take") ? Number(sp.get("take")) : undefined,
      skip:     sp.get("skip") ? Number(sp.get("skip")) : undefined,
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const b = await req.json().catch(() => ({}));

    const connection = await createConnection(workspaceId, userId, {
      sourceType: b.sourceType, sourceKey: String(b.sourceKey ?? ""),
      targetType: b.targetType, targetKey: String(b.targetKey ?? ""),
      name:       String(b.name ?? ""),
      commentary: b.commentary ?? null,
      category:   b.category ?? null,
      tags:       Array.isArray(b.tags) ? b.tags.map(String) : [],
    });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (e) {
    /* A duplicate is not really a failure: the relationship the user wanted
       already exists. Return it with 409 so the client can open it instead of
       showing an error and losing what they typed. */
    if (e instanceof ConnectionError && e.code === "DUPLICATE") {
      return NextResponse.json(
        { error: e.message, existing: e.existing }, { status: 409 },
      );
    }
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}
