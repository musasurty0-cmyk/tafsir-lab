import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  createConnection, listForObject, listCatalogue, connectionMap, ConnectionError,
} from "@/lib/services/connections.service";
import type { ObjectType } from "@/lib/quran-objects";
import { apiError } from "@/lib/api-errors";

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

    /* The map is a different SHAPE, not a different filter: it returns
       Surah-level edges rather than Connection rows, so it gets its own mode
       instead of overloading the catalogue response. */
    if (sp.get("view") === "map") {
      const map = await connectionMap(workspaceId, userId);
      return NextResponse.json(map);
    }

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
    return apiError(e);
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
    return apiError(e);
  }
}
