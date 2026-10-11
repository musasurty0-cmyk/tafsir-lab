-- Youth Majlis: sessions, research assignments, settings, and cohort roles.
-- Everything an organiser edits from /youth-majlis/organise, so running the
-- Majlis never needs a code change. Additive only.

-- One gathering. Dates are UK calendar dates; times are "17:30" strings.
CREATE TABLE "YouthMajlisSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "moduleN" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "date" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "venue" TEXT,
    "ayahFrom" INTEGER,
    "ayahTo" INTEGER,
    "prep" JSONB NOT NULL DEFAULT '[]',
    "prepDue" DATE,
    "takeaways" JSONB NOT NULL DEFAULT '[]',
    "recordingUrl" TEXT,
    "followUp" TEXT,
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "YouthMajlisSession_moduleN_seq_key" ON "YouthMajlisSession"("moduleN", "seq");
CREATE INDEX "YouthMajlisSession_date_idx" ON "YouthMajlisSession"("date");

-- A piece of research set for a session: one of the ten points and/or an
-- āyah range, for one student or a group.
CREATE TABLE "YouthMajlisAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "point" INTEGER,
    "ayahFrom" INTEGER,
    "ayahTo" INTEGER,
    "note" TEXT,
    "due" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "YouthMajlisAssignment_sessionId_idx" ON "YouthMajlisAssignment"("sessionId");
ALTER TABLE "YouthMajlisAssignment" ADD CONSTRAINT "YouthMajlisAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "YouthMajlisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "YouthMajlisAssignee" (
    "assignmentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    CONSTRAINT "YouthMajlisAssignee_pkey" PRIMARY KEY ("assignmentId", "userId")
);
ALTER TABLE "YouthMajlisAssignee" ADD CONSTRAINT "YouthMajlisAssignee_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "YouthMajlisAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YouthMajlisAssignee" ADD CONSTRAINT "YouthMajlisAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Portal-wide settings: the announcement, the shared cohort workspace.
CREATE TABLE "YouthMajlisSettings" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisSettings_pkey" PRIMARY KEY ("id")
);

-- Who is in the cohort, and who runs it. A signed-in visitor through the
-- portal's gate joins as a student; organisers are set from the editor.
ALTER TABLE "YouthMajlisProgress" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'student';
ALTER TABLE "YouthMajlisProgress" ADD COLUMN "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
