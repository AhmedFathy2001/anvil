-- Results wait for every entrant's hiscores read after the end (or 2 hours): lib/weeklyFinish,
-- lib/weeklyFinalRead, lib/statsSweep, lib/eventLifecycle. Additive.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "final_read_at" text;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "results_posted_at" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "final_reads_at" text;--> statement-breakpoint
-- Every competition already finished has had its results posted: never post one again.
UPDATE "weekly_competitions" SET "results_posted_at" = coalesce("prizes_settled_at", to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) WHERE "status" = 'completed' AND "results_posted_at" IS NULL;
