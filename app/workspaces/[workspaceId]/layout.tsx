/**
 * Workspace layout — /workspaces/[workspaceId]/*
 *
 * Intentionally non-blocking: access control is enforced inside each page
 * via getWorkspaceWithRole() (wrapped in gatePage, so a missing or closed
 * workspace is the not-found page). No database round-trip here, which would
 * block loading.tsx from showing and make every navigation feel slow.
 * Middleware handles unauthenticated users before we get here.
 *
 * The one check it does make costs nothing: an id that is not a UUID is a
 * mistyped link. Every page below would otherwise hand it to Postgres, which
 * rejects it as malformed, and the reader got an error page quoting Prisma.
 */
import { notFound } from "next/navigation";
import { WORKSPACE_ID } from "@/lib/services/page-gate";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  if (!WORKSPACE_ID.test(workspaceId)) notFound();
  return <>{children}</>;
}
