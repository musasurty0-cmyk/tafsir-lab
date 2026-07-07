/**
 * /workspaces/[workspaceId]/notes — Notes review
 *
 * The retrieval layer: every note across every page of the workspace,
 * grouped by surah → ayah, searchable and filterable by type.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { fetchChapters } from "@/lib/quran-api";
import NotesReview from "@/components/workspace/NotesReview";

export default async function NotesReviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId } = await getSession();

  const [{ workspace }, chapters] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    fetchChapters(),
  ]);

  return (
    <NotesReview
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      chapters={chapters.map((c) => ({ id: c.id, name: c.name_simple, nameArabic: c.name_arabic }))}
      currentUserId={userId}
    />
  );
}
