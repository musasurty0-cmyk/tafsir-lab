import { NextResponse }  from "next/server";
import { clearSession, getSessionOrNull } from "@/lib/session";
import { db } from "@/lib/db";
import { DEMO_FLAG, deleteDemoUser, isDemoEmail } from "@/lib/demo/provision";

export async function POST() {
  /* Signing out of a demo ends it: the account and everything it made are
     deleted now rather than lingering until something sweeps them. */
  const session = await getSessionOrNull();
  if (session) {
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } });
    if (user && isDemoEmail(user.email)) await deleteDemoUser(session.userId);
  }
  await clearSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEMO_FLAG);
  return res;
}
