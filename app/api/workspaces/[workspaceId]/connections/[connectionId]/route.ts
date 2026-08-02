import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getConnection, updateConnection, deleteConnection, ConnectionError,
} from "@/lib/services/connections.service";

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

type Ctx = { params: Promise<{ workspaceId: string; connectionId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId, connectionId } = await params;
    const { userId } = await getSession();
    const connection = await getConnection(workspaceId, userId, connectionId);
    return NextResponse.json({ connection });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

/** Name, commentary, category and tags only. Endpoints are immutable — see
 *  updateConnection for why. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { workspaceId, connectionId } = await params;
    const { userId } = await getSession();
    const b = await req.json().catch(() => ({}));
    const connection = await updateConnection(workspaceId, userId, connectionId, {
      ...(b.name       !== undefined ? { name: String(b.name) } : {}),
      ...(b.commentary !== undefined ? { commentary: b.commentary } : {}),
      ...(b.category   !== undefined ? { category: b.category } : {}),
      ...(b.tags       !== undefined ? { tags: Array.isArray(b.tags) ? b.tags.map(String) : [] } : {}),
    });
    return NextResponse.json({ connection });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId, connectionId } = await params;
    const { userId } = await getSession();
    const res = await deleteConnection(workspaceId, userId, connectionId);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: errStatus(e) });
  }
}
