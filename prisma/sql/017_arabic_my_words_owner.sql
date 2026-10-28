-- Arabic study: "My words" belongs to one reader, not the whole workspace.
-- A course lesson has no owner (everyone in the workspace shares it); a
-- reader's own "My words" lesson carries their id, so in a group workspace
-- each person's added words stay theirs. Additive only.
ALTER TABLE "ArabicLesson" ADD COLUMN "ownerId" UUID;
ALTER TABLE "ArabicLesson" ADD CONSTRAINT "ArabicLesson_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Any "My words" made before this column existed belongs to whoever answered it.
UPDATE "ArabicLesson" l SET "ownerId" = (
  SELECT r."userId" FROM "ArabicReview" r JOIN "ArabicCard" c ON c.id = r."cardId"
  WHERE c."lessonId" = l.id LIMIT 1
) WHERE l.kind = 'mine' AND l."ownerId" IS NULL;
