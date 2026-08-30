/**
 * apiError — map a thrown service error to a safe HTTP response.
 *
 * Service functions throw WorkspaceError / PageError / NoteError with a `code`
 * ("NOT_FOUND" | "FORBIDDEN" | "CONFLICT"). Routes were catching everything and
 * returning `{ error: String(err) }` with status 500 — which both leaked the
 * raw error text (and sometimes a stack) and reported access denials as server
 * errors. This translates the known codes to real statuses and, crucially,
 * never echoes an unknown error's message to the client: an unexpected failure
 * is a generic 500. The real error is still logged server-side.
 */

import { NextResponse } from "next/server";

type CodedError = { code?: unknown; message?: unknown };

/**
 * Every code the services actually throw, verified against them rather than
 * assumed. INVALID, BAD_RANGE and DUPLICATE were missing, which meant a bad
 * ayah range or a duplicate Connection came back as a 500 "Something went
 * wrong" — the client could not tell the user what to correct, and the log
 * filled with server errors for what was really user input.
 *
 * Keep this in step with the `code` values in lib/services/*.service.ts.
 */
const STATUS: Record<string, number> = {
  NOT_FOUND:    404,
  FORBIDDEN:    403,
  CONFLICT:     409,
  DUPLICATE:    409,
  BAD_REQUEST:  400,
  INVALID:      400,
  BAD_RANGE:    400,
  UNAUTHORIZED: 401,
};

export function apiError(err: unknown): NextResponse {
  const code = (err as CodedError)?.code;
  if (typeof code === "string" && code in STATUS) {
    // These messages are author-written and safe to surface.
    const message = typeof (err as CodedError).message === "string"
      ? (err as CodedError).message as string
      : code;
    return NextResponse.json({ error: message }, { status: STATUS[code] });
  }

  /* Prisma's own codes for input it cannot even parse — almost always a route
     parameter that is not a UUID, from someone editing the address bar or a
     stale link. That is a bad request, not a server fault: it should not page
     anyone and it should not fill the log with 500s.

     Matched on the CODE and answered with our own sentence. This file learned
     once already what happens when you match Prisma on its prose. */
  if (code === "P2023" || code === "P2009") {
    return NextResponse.json({ error: "That identifier is not valid." }, { status: 400 });
  }
  /* Same category, no code: Prisma raises this when the SHAPE of a query is
     wrong, which a malformed id can also cause. Identified by class name,
     which is a fact about the error rather than a guess at its wording. */
  if ((err as { name?: unknown })?.name === "PrismaClientValidationError") {
    return NextResponse.json({ error: "That request could not be understood." }, { status: 400 });
  }

  /* No message sniffing. Session failures now carry code UNAUTHORIZED and are
     handled by the map above. The heuristic this replaces tested the message
     against /not authenticated|expired session|invalid/i, and that bare
     `invalid` caught every Prisma error — they read "Invalid
     `prisma.user.create()` invocation" — so a database outage returned 401
     "Not authenticated" and, because that branch did not log, left no trace at
     all. Matching on prose is guesswork; a code is a fact. */

  // Anything else is unexpected: log it, tell the client nothing specific.
  console.error("[api] unhandled error:", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
