"use client";

import { useEffect } from "react";
import { hideNavSplash } from "@/lib/nav-splash";
import StatusPage from "@/components/StatusPage";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* Clear the navigation splash — including one that is armed but not yet
     painted, which would otherwise land on top of this error page and sit
     there until the failsafe. Removing the elements by hand cannot cancel a
     pending one; hideNavSplash can. */
  useEffect(() => { hideNavSplash(); }, []);

  // Not the raw message (see app/error.tsx); the reference is for a report.
  return (
    <StatusPage
      title="Something went wrong."
      body="This workspace didn’t load. Try again, and if it keeps happening, tell us through Contact us."
      primary={{ label: "Try again", onClick: reset }}
      reference={error.digest}
    />
  );
}
