/**
 * / — Root page
 *
 * Authenticated users are forwarded straight to /home.
 * Everyone else sees the marketing landing page.
 */

import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/session";
import LandingPage from "@/components/LandingPage";

export const metadata = {
  title: "TafsirLab — Collaborative Qurʾān Study",
  description:
    "Write tafsir, annotate the Mushaf, track your progress, and study together in real time.",
};

export default async function RootPage() {
  const session = await getSessionOrNull();
  if (session) redirect("/home");
  return <LandingPage />;
}
