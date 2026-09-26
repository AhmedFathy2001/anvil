-- Platform-managed guide categories (with per-clan extras), and platform edits to the gear
-- calculator: overrides/additions/hidden entries and custom effect rules, plus wiki refreshes done
-- from /staff instead of a deploy. See the notes on each table in db/schema.ts.
CREATE TABLE IF NOT EXISTS "guide_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer REFERENCES "clans"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "icon" text DEFAULT '📖' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "requires_levels" boolean DEFAULT true NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  CONSTRAINT "guide_categories_clan_key_unique" UNIQUE NULLS NOT DISTINCT("clan_id","key")
);
--> statement-breakpoint
-- The list the code shipped with, so nothing changes on day one.
INSERT INTO "guide_categories" ("clan_id","key","label","icon","sort_order","requires_levels","created_at","updated_at") VALUES
  (NULL, 'raids', 'Raids', '🏛️', 0, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'bossing', 'Bossing', '🐉', 10, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'skilling', 'Skilling', '⛏️', 20, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'money', 'Money making', '💰', 30, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'quests', 'Quests & diaries', '📜', 40, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'minigames', 'Minigames', '🎲', 50, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'pvp', 'PvP', '⚔️', 60, true, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'clan', 'Clan info', '🏰', 70, false, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  (NULL, 'general', 'General', '📖', 80, false, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
ON CONFLICT ON CONSTRAINT "guide_categories_clan_key_unique" DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gear_overrides" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "key" text NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "hidden" boolean DEFAULT false NOT NULL,
  "note" text,
  "updated_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gear_overrides_kind_key_unique" ON "gear_overrides" ("kind","key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gear_datasets" (
  "id" serial PRIMARY KEY NOT NULL,
  "items" jsonb NOT NULL,
  "monsters" jsonb NOT NULL,
  "item_count" integer NOT NULL,
  "monster_count" integer NOT NULL,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" text NOT NULL
);
