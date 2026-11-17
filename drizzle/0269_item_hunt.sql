-- Item hunt: the fourth competition kind (weekly_competitions.type = 'hunt').
--   weekly_competitions.hunt   the hunt's rules as JSON (lib/itemHunt HuntConfig): targets, where each
--                              counts from, the rule, what the standings show beside the count.
--                              Null on every other kind.
--   hunt_drops                 one row per drop that counts, or is waiting for staff. A plugin report
--                              (origin 'plugin', counted at once) or a manual proof (origin 'manual':
--                              a screenshot plus the stated kill count or XP, counted once approved).
-- Additive: one nullable column and one new table.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "hunt" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hunt_drops" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL REFERENCES "weekly_competitions"("id") ON DELETE cascade,
	"clan_member_id" integer REFERENCES "clan_memberships"("id") ON DELETE set null,
	"rsn" text NOT NULL,
	"rsn_normalized" text NOT NULL,
	"item_id" integer,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"source" text,
	"kc" integer,
	"xp" bigint,
	"stat_skill" text,
	"stat_basis" text,
	"site_kc" integer,
	"site_xp" bigint,
	"occurred_at" text NOT NULL,
	"origin" text NOT NULL,
	"status" text DEFAULT 'counted' NOT NULL,
	"dedup_key" text NOT NULL,
	"screenshot_url" text,
	"note" text,
	"requested_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"decided_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"decided_by_name" text,
	"decided_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hunt_drops_dedup_unique" ON "hunt_drops" ("competition_id","rsn_normalized","dedup_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hunt_drops_comp_idx" ON "hunt_drops" ("competition_id","status");
