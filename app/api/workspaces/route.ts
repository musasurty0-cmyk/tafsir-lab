/**
 * GET  /api/workspaces   — list all workspaces the user belongs to
 * POST /api/workspaces   — create a new workspace (user becomes owner)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";

export async function GET() {
  try {
    const { userId } = await getSession();
    const workspaces = await WorkspacesService.listForUser(userId);
    return NextResponse.json({ workspaces });
  } catch (err) {
    if (err instanceof Error && err.message.includes("DEFAULT_USER_ID")) {
      return NextResponse.json({ error: "Not configured — run db:seed" }, { status: 503 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const body = await req.json() as { name?: unknown; type?: unknown };

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (body.type !== "private" && body.type !== "group") {
      return NextResponse.json(
        { error: "type must be 'private' or 'group'" },
        { status: 400 }
      );
    }

    const workspace = await WorkspacesService.createWorkspace(
      userId,
      body.name,
      body.type,
    );
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
