/**
 * /workspaces/[workspaceId]/connections — the Connections catalogue.
 *
 * Every munasabah recorded in this workspace, searchable and filterable.
 * A Connection belongs to two study objects rather than to a page, so it
 * cannot be found by browsing pages — this is where it is found instead.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { fetchChapters } from "@/lib/quran-api";
import ConnectionsCatalogue from "@/components/workspace/ConnectionsCatalogue";

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId } = await getSession();

  // Membership is verified here, so the client never renders for a workspace
  // the user cannot access.
  const [{ workspace }, chapters] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    fetchChapters(),
  ]);

  return (
    <ConnectionsCatalogue
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      chapters={chapters.map((c) => ({
        id: c.id,
        name: c.name_simple,
        arabic: c.name_arabic,
        verses: c.verses_count,
        place: c.revelation_place,
      }))}
    />
  );
}
