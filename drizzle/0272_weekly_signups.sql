-- Competitions people sign up for themselves, with an optional entry fee (lib/weeklySignups).
-- self_signup: members enter from the competition's page (used with host_entrants = 'selected').
-- entry_fee: gp owed by each person who signs up; NULL = free.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "self_signup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "entry_fee" integer;--> statement-breakpoint
-- The fee of one entrant, in the same states as an event's (lib/feeRules): NULL status = no fee.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "entered_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_amount" integer;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_status" text;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_collected_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_collected_at" text;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_confirmations" jsonb;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_confirmed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "fee_confirmed_at" text;
