/**
 * Workspace layout — /workspaces/[workspaceId]/*
 *
 * Intentionally non-blocking: access control is enforced inside each page
 * via getWorkspaceWithRole(), which already throws NOT_FOUND / FORBIDDEN.
 * Keeping this layout async (with its own DB round-trips) would block
 * loading.tsx from showing, making every navigation feel slow.
 * Middleware handles unauthenticated users before we get here.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
