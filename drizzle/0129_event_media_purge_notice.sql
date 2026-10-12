-- Reminders before an event's proof images are deleted (lib/eventMediaNotice): when the first and
-- the last went out. Deletion waits at least a week after the first. NULL = not sent yet.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "media_purge_notice_at" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "media_purge_final_notice_at" text;
