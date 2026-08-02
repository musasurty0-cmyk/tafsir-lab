-- Rename, not drop+add: preserves every existing row.
-- Applied with explicit SQL because `prisma db push` treats a renamed column
-- as a DROP plus an ADD, which would have discarded existing Selection names.
ALTER TABLE "QuranSegment" RENAME COLUMN "title" TO "name";
