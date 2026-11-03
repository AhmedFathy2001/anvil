-- Referrals (lib/referrals): a person's public invite code, and one row per referred purchase. The
-- reward is Supporter time the site grants (a supporter_subscriptions row with status 'granted'),
-- held 14 days so a refund or chargeback can take it back first. Numbered 0178 (0177 is the plugin
-- token erase); IF NOT EXISTS throughout so a re-run is harmless.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referral_code");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY NOT NULL,
  "referrer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referred_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "gumroad_subscription_id" text,
  "gumroad_sale_id" text,
  "recurrence" text,
  "status" text NOT NULL,
  "reward_months" integer NOT NULL,
  "reward_subscription_id" integer REFERENCES "supporter_subscriptions"("id") ON DELETE SET NULL,
  "grant_after" text NOT NULL,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_one_per_person" ON "referrals" ("referred_user_id", "kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_due_idx" ON "referrals" ("status", "grant_after");
