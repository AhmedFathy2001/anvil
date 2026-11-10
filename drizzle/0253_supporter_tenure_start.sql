-- Supporter tenure (the star that grows with time) counts unbroken PAID time. A membership row is
-- reused when someone resubscribes, so its started_at can't show a gap: this is when the current
-- unbroken run began. The webhook moves it forward when a row comes back after the grace period.
ALTER TABLE "supporter_subscriptions" ADD COLUMN IF NOT EXISTS "tenure_started_at" text;
--> statement-breakpoint
UPDATE "supporter_subscriptions" SET "tenure_started_at" = "started_at" WHERE "tenure_started_at" IS NULL;
