import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getConnection, updateConnection, deleteConnection,
} from "@/lib/services/connections.service";
import { apiError } from "@/lib/api-errors";

type Ctx = { params: Promise<{ workspaceId: string; connectionId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId, connectionId } = await params;
    const { userId } = await getSession();
    const connection = await getConnection(workspaceId, userId, connectionId);
    return NextResponse.json({ connection });
  } catch (e) {
    return apiError(e);
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
    return apiError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { workspaceId, connectionId } = await params;
    const { userId } = await getSession();
    const res = await deleteConnection(workspaceId, userId, connectionId);
    return NextResponse.json(res);
  } catch (e) {
    return apiError(e);
  }
}
