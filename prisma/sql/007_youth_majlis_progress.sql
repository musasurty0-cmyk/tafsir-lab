-- Youth Majlis: one row per student, holding their portal progress so it
-- follows them across devices, and the workspace "Open in TafsirLab" uses.
--
--   entries      { "<key>": { "v": <value>, "at": <ms epoch> } }
--                keys: explored:<module>  reflect:<module>:<i>  read
--                Merged key by key on the newest "at", so two devices never
--                lose each other's edits and an untick wins over an old tick.
--   workspaceId  pinned on first open, so renaming the workspace (or a double
--                tap) never makes a second one.
--
-- Additive only.

-- CreateTable
CREATE TABLE "YouthMajlisProgress" (
    "userId" UUID NOT NULL,
    "entries" JSONB NOT NULL DEFAULT '{}',
    "workspaceId" UUID,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisProgress_pkey" PRIMARY KEY ("userId")
);
-- AddForeignKey
ALTER TABLE "YouthMajlisProgress" ADD CONSTRAINT "YouthMajlisProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
