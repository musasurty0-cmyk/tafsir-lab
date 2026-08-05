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

  // "Not authenticated" / "Invalid or expired session" from the session layer.
  const msg = (err as CodedError)?.message;
  if (typeof msg === "string" && /not authenticated|expired session|invalid/i.test(msg)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Anything else is unexpected: log it, tell the client nothing specific.
  console.error("[api] unhandled error:", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
