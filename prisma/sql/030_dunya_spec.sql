-- /dunya: the Maths specification tracker, kept apart from progress so a tap on
-- a topic never races a paper score being saved (each is its own atomic
-- UPDATE). Shape: { "tutor": "<name>", "topics": { "<topicId>": {
-- "lesson": "red|amber|green", "questions": "red|green",
-- "confidence": "red|amber|green" } } }. The tutor's name lives here, not in
-- the public repository. Additive only.
ALTER TABLE "DunyaPlan" ADD COLUMN IF NOT EXISTS "spec" JSONB NOT NULL DEFAULT '{}'::jsonb;
