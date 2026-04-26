/**
 * seed-minimal — creates the bare minimum to run TafsirLab:
 *   • One user
 *   • One private workspace
 *   • The 8-Question system template
 *   • Seed TafsirSource records (catalog, no content yet)
 *
 * Does NOT create demo pages, notes, or drawings.
 *
 * Run:  npm run db:seed-minimal
 *
 * After running, paste the printed IDs into .env:
 *   DEFAULT_USER_ID=...
 *   DEFAULT_WORKSPACE_ID=...
 *
 * To ingest tafsir content after seeding:
 *   npm run tafsir:ingest -- --surah 1
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Minimal seed starting...\n");

  // ── Default user ──────────────────────────────────────────────────────
  const user = await db.user.upsert({
    where: { email: "admin@tafsirlab.local" },
    update: {},
    create: {
      email: "admin@tafsirlab.local",
      name: "Abdullah B.",
      avatarUrl: null,
    },
  });
  console.log(`  User:      ${user.id}  (${user.email})`);

  // ── Default private workspace ─────────────────────────────────────────
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
  console.log(`  Workspace: ${workspace.id}  ("${workspace.name}")`);

  // ── Owner membership ──────────────────────────────────────────────────
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });

  // ── System template ───────────────────────────────────────────────────
  await db.pageTemplate.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "8-Question Tafsir Framework",
      surahNumber: null,
      isSystem: true,
      structure: [
        { title: "1. What does the surah primarily discuss?",      orderIndex: 0, isAdminLocked: false },
        { title: "2. Names & titles of the surah",                orderIndex: 1, isAdminLocked: false },
        { title: "3. Key linguistic features & vocabulary",       orderIndex: 2, isAdminLocked: false },
        { title: "4. Thematic connections to other surahs",       orderIndex: 3, isAdminLocked: false },
        { title: "5. Classical scholars' positions & commentary", orderIndex: 4, isAdminLocked: false },
        { title: "6. Lessons and extracted rulings (fiqh)",       orderIndex: 5, isAdminLocked: false },
        { title: "7. Spiritual & practical applications",         orderIndex: 6, isAdminLocked: false },
        { title: "8. Personal reflections & questions",           orderIndex: 7, isAdminLocked: false },
      ],
    },
  });
  console.log("  Template:  8-Question Tafsir Framework  (system)");

  // ── Tafsir source catalog ─────────────────────────────────────────────
  // These define WHERE to fetch from; TafsirEntry holds the actual content.
  const sources = [
    {
      slug:        "ibn-kathir-en",
      name:        "Ibn Kathīr (English)",
      nameArabic:  "ابن كثير",
      language:    "en",
      type:        "api",
      config:      { provider: "quran.com", tafsirId: 169 },
      isActive:    true,
    },
    {
      slug:        "ibn-kathir-ar",
      name:        "Ibn Kathīr (Arabic)",
      nameArabic:  "ابن كثير",
      language:    "ar",
      type:        "api",
      config:      { provider: "quran.com", tafsirId: 91 },
      isActive:    true,
    },
    {
      slug:        "tabari-ar",
      name:        "Al-Ṭabarī (Arabic)",
      nameArabic:  "الطبري",
      language:    "ar",
      type:        "scrape",
      config:      { provider: "tafsir.app", slug: "tabari" },
      isActive:    false,   // enable once scraper is validated
    },
  ];

  for (const src of sources) {
    await db.tafsirSource.upsert({
      where:  { slug: src.slug },
      update: { name: src.name, config: src.config, isActive: src.isActive },
      create: src,
    });
  }
  console.log(`  TafsirSources: ${sources.length} catalog entries seeded`);

  // ── Done ──────────────────────────────────────────────────────────────
  console.log("\n✅ Minimal seed complete.\n");
  console.log("Add these to your .env:\n");
  console.log(`DEFAULT_USER_ID="${user.id}"`);
  console.log(`DEFAULT_WORKSPACE_ID="${workspace.id}"`);
  console.log("\nTo load tafsir content:");
  console.log("  npm run tafsir:ingest -- --source ibn-kathir-en --surah 1\n");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
