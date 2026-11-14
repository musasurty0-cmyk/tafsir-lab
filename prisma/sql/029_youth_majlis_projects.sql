-- Projects: the small pieces of work the shaykh sets ("compile the verses that
-- honour Mūsā and the Torah"). A project is an assignment with a title. It is
-- usually for the whole cohort, and it is done together on one page of the
-- shared cohort workspace, made the first time anyone opens it.
--
--   title     set: a project; null: research on a point, as before
--   everyone  for the whole cohort, not only the students chosen
--   pageId    its page in the cohort workspace. No foreign key on purpose:
--             a deleted page is simply made again on the next open.
ALTER TABLE "YouthMajlisAssignment"
    ADD COLUMN IF NOT EXISTS "title" TEXT,
    ADD COLUMN IF NOT EXISTS "everyone" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "pageId" UUID;
