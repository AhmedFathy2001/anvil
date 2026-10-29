-- Per-event Discord choices (on top of the clan's defaults) and each co-host's own choices for a board it plays. Expand-only: both default to empty = follow the clan / everything the host shares.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "discord_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "discord_cleanup" text;--> statement-breakpoint
ALTER TABLE "event_cohosts" ADD COLUMN IF NOT EXISTS "discord_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
-- Events that already ended are settled: turning cleanup on later must never reach back and delete an old event's channels.
UPDATE "events" SET "discord_cleanup" = 'all' WHERE "end_notified" = 1 AND "discord_cleanup" IS NULL;
