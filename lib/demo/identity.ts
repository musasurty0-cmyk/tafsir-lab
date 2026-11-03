/**
 * Who is a demo guest.
 *
 * Decided from the account itself, never from the readable `tl-demo` cookie
 * (see lib/demo/provision), which a visitor can delete. Kept apart from
 * provision.ts so that the services provision depends on can use it too.
 */

import { db } from "@/lib/db";

export const DEMO_DOMAIN = "demo.tafsirlab.local";

export const isDemoEmail = (email: string) => email.endsWith(`@${DEMO_DOMAIN}`);

/** Is this account a demo guest? False for an account that no longer exists. */
export async function isDemoUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return !!user && isDemoEmail(user.email);
}
