/**
 * For pages, not API routes: a workspace that does not exist, or that the
 * reader is not in, is a missing page.
 *
 * The services throw WorkspaceError, which an API route turns into a 404 or
 * 403. A page that let it escape landed on the error boundary instead, and in
 * production Next replaces a server error's message with a generic one, so
 * the reader of a dead link got "Something went wrong" and a sentence about
 * Server Components. Wrap the page's lookups in this to get the not-found page.
 */
import { notFound } from "next/navigation";
import { WorkspaceError } from "./workspaces.service";

export async function gatePage<T>(lookup: Promise<T>): Promise<T> {
  try {
    return await lookup;
  } catch (err) {
    if (err instanceof WorkspaceError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) notFound();
    throw err;
  }
}

/** Workspace ids are UUIDs; anything else is a mistyped link, not a query. */
export const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
