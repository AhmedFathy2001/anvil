-- Sign-ups are optional per event: off, players are only ever added by staff (by hand, "Add them all",
-- or the auto option below) and the public form is closed. On by default, so every board keeps its form.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "signups_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- "Keep adding new plugin members": the placement auto-enrol uses (draft_pool | one_team | individual),
-- re-run by the cron until the event starts. Null = off.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "auto_enroll" text;
