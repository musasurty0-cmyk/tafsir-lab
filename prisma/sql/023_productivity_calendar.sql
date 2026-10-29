-- Productivity shows the events of one Apple Calendar, read from the link the
-- Calendar app gives a calendar shared as "Public Calendar". The link is the
-- only key to that calendar, so it lives here beside the plan and is never
-- sent to the browser.
ALTER TABLE "ProductivityPlan" ADD COLUMN IF NOT EXISTS "calendarUrl" TEXT;
