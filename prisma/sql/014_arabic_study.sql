-- Arabic study workspaces (kind = 'arabic'): a course's flashcard decks,
-- imported by the reader from their own files. The course content lives only
-- here, in the reader's workspace — never in the repository, which is public.
--
--   ArabicLesson       one deck. `fileNo` is the number in the file name;
--                      `number` is the course's own lesson number, NULL for
--                      revision and preparation files, which sit in the
--                      sequence without taking a number.
--   ArabicCard         one card. `folded` is the Arabic with ḥarakāt and
--                      letter variants folded away, for search.
--   ArabicLessonState  where each reader is: 'covered' or 'current'. Per
--                      reader, so a group workspace can share decks while
--                      everyone keeps their own place.
--
-- Additive only.

CREATE TABLE "ArabicLesson" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "fileNo" INTEGER NOT NULL,
    "number" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'lesson',
    "title" TEXT NOT NULL,
    "cardCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArabicLesson_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArabicLesson_workspaceId_level_fileNo_key" ON "ArabicLesson"("workspaceId", "level", "fileNo");
ALTER TABLE "ArabicLesson" ADD CONSTRAINT "ArabicLesson_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ArabicCard" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lessonId" UUID NOT NULL,
    "ord" INTEGER NOT NULL,
    "grp" INTEGER NOT NULL DEFAULT 0,
    "english" TEXT NOT NULL,
    "arabic" TEXT NOT NULL,
    "translit" TEXT,
    "gender" TEXT,
    "isSentence" BOOLEAN NOT NULL DEFAULT false,
    "folded" TEXT NOT NULL,
    CONSTRAINT "ArabicCard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ArabicCard_lessonId_ord_idx" ON "ArabicCard"("lessonId", "ord");
ALTER TABLE "ArabicCard" ADD CONSTRAINT "ArabicCard_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ArabicLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ArabicLessonState" (
    "userId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArabicLessonState_pkey" PRIMARY KEY ("userId", "lessonId")
);
ALTER TABLE "ArabicLessonState" ADD CONSTRAINT "ArabicLessonState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArabicLessonState" ADD CONSTRAINT "ArabicLessonState_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ArabicLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
