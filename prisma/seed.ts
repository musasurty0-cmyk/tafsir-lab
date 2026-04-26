/**
 * Seed: creates the default user, private workspace, and the
 * 8-question Tafsir study template.
 *
 * Run once after `prisma migrate dev`:
 *   npx ts-node --project tsconfig.json -e "require('./prisma/seed')"
 *   — or —
 *   npx prisma db seed
 *
 * Paste the printed IDs into .env as DEFAULT_USER_ID / DEFAULT_WORKSPACE_ID.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // ── Default user ──────────────────────────────────────────────
  const user = await db.user.upsert({
    where: { email: "admin@tafsirlab.local" },
    update: {},
    create: {
      email: "admin@tafsirlab.local",
      name: "Abdullah B.",
      avatarUrl: null,
    },
  });

  // ── Default private workspace ─────────────────────────────────
  const workspace = await db.workspace.upsert({
    where: { inviteCode: "default-private" },
    update: {},
    create: {
      name: "Tafsir Scholars",
      type: "private",
      ownerId: user.id,
      inviteCode: "default-private",
    },
  });

  // ── Ensure the user is a member (owner) ──────────────────────
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });

  // ── 8-Question study template ─────────────────────────────────
  await db.pageTemplate.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "8-Question Tafsir Framework",
      surahNumber: null, // universal
      isSystem: true,
      structure: [
        { title: "1. What does the surah primarily discuss?",     orderIndex: 0, isAdminLocked: false },
        { title: "2. Names & titles of the surah",               orderIndex: 1, isAdminLocked: false },
        { title: "3. Key linguistic features & vocabulary",      orderIndex: 2, isAdminLocked: false },
        { title: "4. Thematic connections to other surahs",      orderIndex: 3, isAdminLocked: false },
        { title: "5. Classical scholars' positions & commentary",orderIndex: 4, isAdminLocked: false },
        { title: "6. Lessons and extracted rulings (fiqh)",      orderIndex: 5, isAdminLocked: false },
        { title: "7. Spiritual & practical applications",        orderIndex: 6, isAdminLocked: false },
        { title: "8. Personal reflections & questions",          orderIndex: 7, isAdminLocked: false },
      ],
    },
  });

  console.log("\n✅ Seed complete. Add these to your .env:\n");
  console.log(`DEFAULT_USER_ID="${user.id}"`);
  console.log(`DEFAULT_WORKSPACE_ID="${workspace.id}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
