/**
 * /dunya — the owner's A levels: each subject's papers, their worked answers
 * or mark schemes to download, and a score, a date and a traffic-light
 * confidence logged against each one.
 *
 * Behind a password (lib/dunya/gate.ts), not a sign-in. Until it is given
 * only the gate is sent; the paper list and the log live in DunyaPlan and the
 * PDFs in a private R2 bucket, none of it in this public repository.
 */

export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/dunya/gate";
import { asCatalog, asProgress } from "@/lib/dunya/catalog";
import DunyaGate from "@/components/dunya/DunyaGate";
import DunyaApp from "@/components/dunya/DunyaApp";

export default async function DunyaPage() {
  if (!(await hasAccess())) return <DunyaGate />;
  const row = await db.dunyaPlan.findUnique({ where: { id: PLAN_ID }, select: { catalog: true, progress: true } });
  if (!row) return <DunyaGate />;
  return <DunyaApp catalog={asCatalog(row.catalog)} progress={asProgress(row.progress)} />;
}
