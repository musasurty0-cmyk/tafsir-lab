"use client";

import StatusPage from "@/components/StatusPage";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* Never the raw message: in production a server error's is a generic
     sentence about Server Components, and in development it is a Prisma or
     stack dump. Neither helps the reader; the reference helps a report. */
  return (
    <StatusPage
      title="Something went wrong."
      body="This page didn’t load. Try again, and if it keeps happening, tell us through Contact us."
      primary={{ label: "Try again", onClick: reset }}
      reference={error.digest}
    />
  );
}
