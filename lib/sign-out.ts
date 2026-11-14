"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * Sign out everywhere it matters: the server session cookie, then Firebase,
 * then a HARD navigation to /login. A client push would keep the signed-in
 * React tree (and its caches) alive behind the login screen.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await getFirebaseAuth().signOut(); } catch { /* not signed in there */ }
  } finally {
    window.location.href = "/login";
  }
}
