/**
 * / — rewritten to /landing.html (static marketing page) by next.config.ts.
 * This component is never rendered in practice.
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
