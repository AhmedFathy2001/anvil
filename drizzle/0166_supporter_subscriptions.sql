-- Anvil Supporter: the personal subscription (lib/supporter). A checkout ref on the login, so a
-- Gumroad sale can name its buyer, and one row per membership bought. Numbered 0166 because 0165 is
-- taken on another branch; every statement is IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supporter_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_supporter_ref_unique" ON "users" ("supporter_ref");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supporter_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tier" text NOT NULL,
  "status" text NOT NULL,
  "recurrence" text,
  "gumroad_subscription_id" text,
  "gumroad_sale_id" text,
  "current_period_end" text,
  "started_at" text NOT NULL,
  "ended_at" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supporter_subscriptions_gumroad_sub_unique" ON "supporter_subscriptions" ("gumroad_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supporter_subscriptions_user_idx" ON "supporter_subscriptions" ("user_id");
