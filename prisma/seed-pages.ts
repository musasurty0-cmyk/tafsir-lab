/**
 * seed-pages — creates 8-question template pages for Al-Fatihah (surah 1)
 * and adds a couple of test notes for Phase 5 anchor engine verification.
 *
 * Run: npx tsx prisma/seed-pages.ts
 * Safe to run multiple times (skips if pages already exist).
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TEMPLATE_ID  = "00000000-0000-0000-0000-000000000001";
const SURAH_NUMBER = 1;

const TEMPLATE_SLOTS = [
  { title: "1. What does the surah primarily discuss?",      orderIndex: 0 },
  { title: "2. Names & titles of the surah",                orderIndex: 1 },
  { title: "3. Key linguistic features & vocabulary",       orderIndex: 2 },
  { title: "4. Thematic connections to other surahs",       orderIndex: 3 },
  { title: "5. Classical scholars' positions & commentary", orderIndex: 4 },
  { title: "6. Lessons and extracted rulings (fiqh)",       orderIndex: 5 },
  { title: "7. Spiritual & practical applications",         orderIndex: 6 },
  { title: "8. Personal reflections & questions",           orderIndex: 7 },
];

async function main() {
  // ── Resolve user + workspace ──────────────────────────────────────────
  const userId = process.env.DEFAULT_USER_ID;
  if (!userId) throw new Error("DEFAULT_USER_ID not set in .env");

  const workspace = await db.workspace.findFirst({ where: { inviteCode: "default-private" } });
  if (!workspace) throw new Error("Default workspace not found — run db:seed first");

  // ── Find or create the WorkspaceSurah for Al-Fatihah ─────────────────
  let workspaceSurah = await db.workspaceSurah.findUnique({
    where: { workspaceId_surahNumber: { workspaceId: workspace.id, surahNumber: SURAH_NUMBER } },
    include: { pages: true },
  });

  if (!workspaceSurah) {
    workspaceSurah = await db.workspaceSurah.create({
      data: { workspaceId: workspace.id, surahNumber: SURAH_NUMBER, templateId: TEMPLATE_ID },
      include: { pages: true },
    });
    console.log("Created WorkspaceSurah for Al-Fatihah");
  }

  // ── Create pages if none exist ────────────────────────────────────────
  if (workspaceSurah.pages.length > 0) {
    console.log(`Pages already exist (${workspaceSurah.pages.length}). Skipping page creation.`);
  } else {
    await db.page.createMany({
      data: TEMPLATE_SLOTS.map((slot) => ({
        workspaceSurahId: workspaceSurah!.id,
        title:            slot.title,
        orderIndex:       slot.orderIndex,
        status:           "published",       // published so it's visible without extra auth
        isAdminAuthored:  false,
        templateId:       TEMPLATE_ID,
        templatePageIdx:  slot.orderIndex,
        createdById:      userId,
      })),
    });
    console.log(`Created ${TEMPLATE_SLOTS.length} pages for Al-Fatihah`);
  }

  // ── Re-fetch pages ────────────────────────────────────────────────────
  const pages = await db.page.findMany({
    where: { workspaceSurahId: workspaceSurah.id },
    orderBy: { orderIndex: "asc" },
  });

  const firstPage = pages[0];
  if (!firstPage) throw new Error("No pages found after creation");

  // ── Seed test notes on page 1 for anchor engine verification ─────────
  const existingNotes = await db.structuredNote.count({ where: { pageId: firstPage.id } });

  if (existingNotes > 0) {
    console.log(`Notes already exist (${existingNotes}). Skipping note creation.`);
  } else {
    function tipTap(text: string) {
      return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
    }

    await db.structuredNote.createMany({
      data: [
        // Ayah 1 — ayah-anchored note
        {
          pageId:      firstPage.id,
          authorId:    userId,
          noteType:    "thematic",
          anchorType:  "ayah",
          surahNumber: SURAH_NUMBER,
          ayahNumber:  1,
          wordPosition:null,
          content:     tipTap("Bismillah opens every surah as a divine invocation — this ayah sets the frame for all that follows."),
          offsetX:     40,
          offsetY:     0,
          width:       280,
          zIndex:      1,
        },
        // Ayah 1 — word-anchored note (word 2: "Ar-Rahman")
        {
          pageId:      firstPage.id,
          authorId:    userId,
          noteType:    "linguistic",
          anchorType:  "word",
          surahNumber: SURAH_NUMBER,
          ayahNumber:  1,
          wordPosition:2,
          content:     tipTap("Ar-Raḥmān (الرحمن) — intensive form of mercy, emphasising breadth of divine compassion."),
          offsetX:     40,
          offsetY:     80,
          width:       280,
          zIndex:      2,
        },
        // Ayah 2 — ayah-anchored note
        {
          pageId:      firstPage.id,
          authorId:    userId,
          noteType:    "callout",
          anchorType:  "ayah",
          surahNumber: SURAH_NUMBER,
          ayahNumber:  2,
          wordPosition:null,
          content:     tipTap("Al-Ḥamd is the comprehensive praise that encompasses all gratitude — scholars note it is unique to Allah alone."),
          offsetX:     40,
          offsetY:     0,
          width:       280,
          zIndex:      3,
        },
        // Page-anchored note
        {
          pageId:      firstPage.id,
          authorId:    userId,
          noteType:    "text",
          anchorType:  "page",
          surahNumber: null,
          ayahNumber:  null,
          wordPosition:null,
          content:     tipTap("Study session: Al-Fatihah — the Opening. Seven ayahs, recited in every rak'ah."),
          offsetX:     40,
          offsetY:     40,
          width:       280,
          zIndex:      0,
        },
      ],
    });
    console.log("Created 4 test notes (ayah ×2, word ×1, page ×1)");
  }

  console.log("\n✅ Done.");
  console.log(`   Workspace:  ${workspace.id}`);
  console.log(`   Surah:      Al-Fatihah (${SURAH_NUMBER})`);
  console.log(`   Pages:      ${pages.length}`);
  console.log(`   First page: ${firstPage.id}`);
  console.log(`\nOpen: /workspaces/${workspace.id}/surahs/${SURAH_NUMBER}/pages/${firstPage.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
