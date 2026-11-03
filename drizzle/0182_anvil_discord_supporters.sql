-- The Anvil Discord: "new supporter" posts (lib/anvilDiscord). A person can opt out of being announced,
-- and each membership records when it was announced so a renewal never posts again. Rows from before
-- this migration count as announced: they are not new. IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "announce_supporter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "supporter_subscriptions" ADD COLUMN IF NOT EXISTS "announced_at" text;--> statement-breakpoint
UPDATE "supporter_subscriptions" SET "announced_at" = "started_at" WHERE "announced_at" IS NULL;
