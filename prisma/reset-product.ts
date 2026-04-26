/**
 * reset-product — wipes all test/demo content, preserving only the
 * default user and their single private workspace.
 *
 * Run:  npm run db:reset-product
 *
 * What is removed:
 *   • All StructuredNotes, CanvasDrawings, PageUserPrefs
 *   • All PersonalAyahProgress, GroupAyahProgress
 *   • All Pages
 *   • All WorkspaceSurahs  (started-surah sessions)
 *   • All ActivityLogs
 *   • All TafsirFetchJobs, TafsirEntries
 *   • Extra workspaces (anything beyond the default-private one)
 *
 * What is preserved:
 *   • The default user (admin@tafsirlab.local)
 *   • The default private workspace (inviteCode = "default-private")
 *   • The system PageTemplate (8-Question Framework)
 *   • All TafsirSource records
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🧹 Starting product reset...\n");

  // ── Resolve default workspace (the one we keep) ───────────────────────
  const defaultWorkspace = await db.workspace.findFirst({
    where: { inviteCode: "default-private" },
    select: { id: true, name: true },
  });

  if (!defaultWorkspace) {
    throw new Error(
      "Default workspace not found.\n" +
      "Run `npm run db:seed` first, then paste DEFAULT_USER_ID / DEFAULT_WORKSPACE_ID into .env."
    );
  }

  console.log(`  Preserving workspace: "${defaultWorkspace.name}" (${defaultWorkspace.id})\n`);

  // ── 1. Clear note/drawing/prefs/progress data ─────────────────────────
  const [notes, drawings, prefs, personal, group] = await Promise.all([
    db.structuredNote.deleteMany({}),
    db.canvasDrawing.deleteMany({}),
    db.pageUserPrefs.deleteMany({}),
    db.personalAyahProgress.deleteMany({}),
    db.groupAyahProgress.deleteMany({}),
  ]);
  console.log(`  Deleted ${notes.count} structured notes`);
  console.log(`  Deleted ${drawings.count} canvas drawings`);
  console.log(`  Deleted ${prefs.count} page user prefs`);
  console.log(`  Deleted ${personal.count} personal ayah progress records`);
  console.log(`  Deleted ${group.count} group ayah progress records`);

  // ── 2. Clear pages ────────────────────────────────────────────────────
  const pages = await db.page.deleteMany({});
  console.log(`  Deleted ${pages.count} pages`);

  // ── 3. Clear surah sessions ───────────────────────────────────────────
  const surahs = await db.workspaceSurah.deleteMany({});
  console.log(`  Deleted ${surahs.count} workspace surah sessions`);

  // ── 4. Clear activity logs ────────────────────────────────────────────
  const logs = await db.activityLog.deleteMany({});
  console.log(`  Deleted ${logs.count} activity log entries`);

  // ── 5. Clear tafsir ingestion data ───────────────────────────────────
  const [fetchJobs, tafsirEntries] = await Promise.all([
    db.tafsirFetchJob.deleteMany({}),
    db.tafsirEntry.deleteMany({}),
  ]);
  console.log(`  Deleted ${fetchJobs.count} tafsir fetch jobs`);
  console.log(`  Deleted ${tafsirEntries.count} tafsir entries`);

  // ── 6. Remove extra workspaces (keep default-private) ────────────────
  const extraWorkspaces = await db.workspace.findMany({
    where: { id: { not: defaultWorkspace.id } },
    select: { id: true, name: true },
  });

  if (extraWorkspaces.length > 0) {
    // WorkspaceMembers cascade via onDelete: Cascade
    const deleted = await db.workspace.deleteMany({
      where: { id: { in: extraWorkspaces.map((w) => w.id) } },
    });
    console.log(
      `  Deleted ${deleted.count} extra workspace(s): ` +
      extraWorkspaces.map((w) => `"${w.name}"`).join(", ")
    );
  } else {
    console.log("  No extra workspaces to remove");
  }

  // ── Done ──────────────────────────────────────────────────────────────
  console.log("\n✅ Product reset complete.\n");
  console.log("  The following are preserved:");
  console.log("    • Default user (admin@tafsirlab.local)");
  console.log(`    • Default workspace "${defaultWorkspace.name}"`);
  console.log("    • System page template (8-Question Framework)");
  console.log("    • TafsirSource catalog records");
  console.log("\n  Ready for a clean user journey. 🚀\n");
}

main()
  .catch((e) => { console.error("Reset failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
