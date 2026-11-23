-- The clan fund (lib/clanFund): the owner starts a fund for one plan; members chip in with yearly
-- Gumroad memberships until the goal (that plan's yearly price) is met, and the fund then pays for it.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "fund_plan" text;
--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "fund_funded" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "fund_short_since" text;
--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "fund_ref" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clans_fund_ref_unique" ON "clans" ("fund_ref");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_fund_pledges" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "is_payer" boolean DEFAULT false NOT NULL,
  "cents" integer NOT NULL,
  "currency" text,
  "recurrence" text,
  "status" text NOT NULL,
  "gumroad_subscription_id" text,
  "gumroad_sale_id" text,
  "applied_sale_ids" text DEFAULT '[]' NOT NULL,
  "current_period_end" text,
  "started_at" text NOT NULL,
  "cancelled_at" text,
  "ended_at" text,
  "show_badge" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_fund_pledges_sub_unique" ON "clan_fund_pledges" ("gumroad_subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_fund_pledges_clan_idx" ON "clan_fund_pledges" ("clan_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_fund_pledges_user_idx" ON "clan_fund_pledges" ("user_id");
