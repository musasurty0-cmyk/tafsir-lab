/**
 * / — Root page
 *
 * Middleware redirects unauthenticated users to /login before they reach here.
 * Authenticated users are forwarded to /home.
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}
