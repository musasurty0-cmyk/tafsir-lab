/**
 * /workspaces/[workspaceId]/whiteboard — the single default board.
 *
 * Study workspaces have one blank board reached from the "Blank board" button;
 * this get-or-creates it and redirects to its canonical /whiteboard/[boardId]
 * URL. Boards workspaces navigate straight to /whiteboard/[boardId] instead.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import * as PagesService from "@/lib/services/pages.service";

export default async function WhiteboardRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId } = await getSession();
  const { pageId } = await PagesService.getOrCreateWorkspaceWhiteboard(workspaceId, userId);
  redirect(`/workspaces/${workspaceId}/whiteboard/${pageId}`);
}
