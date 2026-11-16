-- Billing rework: trials, upgrades and staff gifts (2026-11-16). Additive only.
--
-- 1. clan_extra_memberships: a Gumroad membership bought through a clan's (or creator space's)
--    checkout that is NOT the one on its clans row. Two states:
--      'to_cancel'  the older membership after an upgrade purchase: it keeps charging on Gumroad
--                   until the owner cancels it there. Open until a cancellation or end arrives.
--      'waiting'    a new membership Gumroad started with a free trial on a clan that is paying for
--                   another and has had a membership before: it takes over at its first real charge.
--    The webhook finds these by subscription id when no clans row holds it.
-- 2. supporter_subscriptions.queued_days: staff "add time" for someone who pays through Gumroad for
--    that tier. The row has status 'queued' (in force for nobody) and starts, for this many days,
--    when their paid membership at that tier stops.
-- 3. owner_trials.remind_requested_at / reminded_at: "Remind me when the trial ends" and the notice
--    that answered it.
--
-- Numbered 0267 (0266 is banned_discord_ids).
CREATE TABLE IF NOT EXISTS "clan_extra_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL,
	"gumroad_subscription_id" text NOT NULL,
	"plan" text NOT NULL,
	"state" text NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"last_charged_at" timestamp with time zone,
	"noted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	CONSTRAINT "clan_extra_memberships_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clan_extra_memberships_state_check" CHECK ("state" IN ('to_cancel', 'waiting'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_extra_memberships_sub_unique" ON "clan_extra_memberships" USING btree ("gumroad_subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_extra_memberships_clan_idx" ON "clan_extra_memberships" USING btree ("clan_id");
--> statement-breakpoint
ALTER TABLE "supporter_subscriptions" ADD COLUMN IF NOT EXISTS "queued_days" integer;
--> statement-breakpoint
ALTER TABLE "owner_trials" ADD COLUMN IF NOT EXISTS "remind_requested_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "owner_trials" ADD COLUMN IF NOT EXISTS "reminded_at" timestamp with time zone;
