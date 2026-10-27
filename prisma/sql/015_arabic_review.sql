-- Arabic study: each reader's memory of each card (lib/arabic/srs).
--
--   box     0 not known · 1–4 learning · 5+ learnt
--   due     when the card next comes back
--   reps    answers given; lapses: times it was missed after being known
--
-- One row per reader per card, created the first time the card is answered.
-- No row means not known. Additive only.

CREATE TABLE "ArabicReview" (
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArabicReview_pkey" PRIMARY KEY ("userId", "cardId")
);
CREATE INDEX "ArabicReview_userId_due_idx" ON "ArabicReview"("userId", "due");
ALTER TABLE "ArabicReview" ADD CONSTRAINT "ArabicReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArabicReview" ADD CONSTRAINT "ArabicReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ArabicCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
