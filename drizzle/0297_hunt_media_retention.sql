-- Item hunts and Boss Rushes: drop screenshots are deleted 90 days after the end, like an event's
-- proofs, with the same reminders (lib/huntMediaRetention). Additive, nullable.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "media_purged_at" text;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "media_purge_notice_at" text;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "media_purge_final_notice_at" text;
