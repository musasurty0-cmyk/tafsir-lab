-- A private timetable (/productivity). The plan, its draft and the password
-- that guards it live here, never in the repository: the repository is
-- public and the plan is personal. passwordHash is scrypt (see
-- lib/productivity/gate.ts); state is what the page saves as you edit.
CREATE TABLE "ProductivityPlan" (
    "id" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "state" JSONB,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductivityPlan_pkey" PRIMARY KEY ("id")
);
