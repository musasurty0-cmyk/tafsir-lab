/**
 * Workspace layout — /workspaces/[workspaceId]/*
 *
 * Validates workspace access for all nested routes.
 * Does NOT inject chrome (Rail lives inside each page's client component
 * so page-level data fetches can drive it without prop-drilling through layout).
 */

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    const { userId } = await getSession();
    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      if (err.code === "NOT_FOUND") notFound();
      // FORBIDDEN → back to home
      redirect("/home");
    }
    // Session not configured → root will handle setup screen
    redirect("/");
  }

  return <>{children}</>;
}
