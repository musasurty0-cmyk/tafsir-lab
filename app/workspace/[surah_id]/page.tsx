/**
 * /workspace/[surah_id] — Legacy route.
 *
 * Redirects to the new URL structure introduced in Phase 2.
 * Uses DEFAULT_WORKSPACE_ID from env (Phase 2 auth placeholder).
 */

import { redirect } from "next/navigation";

export default async function LegacyWorkspacePage({
  params,
}: {
  params: Promise<{ surah_id: string }>;
}) {
  const { surah_id } = await params;
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  if (workspaceId) {
    redirect(`/workspaces/${workspaceId}/surahs/${surah_id}`);
  }

  // No workspace configured — redirect to root setup screen.
  redirect("/");
}
