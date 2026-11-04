-- CLAN BOOSTS (lib/clanBoosts, lib/clanBoostRules). A paying Supporter has boost slots (Supporter 1,
-- Champion 2, Patron 3) and places each by hand on a clan where one of their characters holds a live
-- MEMBER seat at least 14 days old. Visibility and cosmetics only: never a rank, a score, a seat or a
-- plan feature. A boost rides on its seat, so the clan sees that character and never the person.
--
--   clan_boosts       one row per placement. Moving a boost ends its row ('moved') and starts a new
--                     one in the same slot; removing ends it ('removed'). Ended rows are history: the
--                     "first booster" badge reads them. `slot` is the person's slot number (1–3), and
--                     one live row per slot is the guard that two tabs can't overfill the pool.
--                     `reusable_at` is when a removed row's slot may take a new boost (the 7-day move
--                     cooldown, so remove + place can't skip it). `level_up` is the level this
--                     placement lifted its clan to, when it did (the "Level-up" badge).
--   clan_boost_state  per clan: the level in force and `dropped_at`, when its counted boosts fell
--                     below that level — the clan keeps the level's perks for 7 days from then.
--                     Plus the clan-written recruiting line (L2) and the last monthly recruitment post
--                     into Anvil's own Discord (L3, one per calendar month).
--
-- Numbered 0218 (0217 is seat_push_people). IF NOT EXISTS throughout, so a re-run is harmless.
CREATE TABLE IF NOT EXISTS "clan_boosts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "clan_member_id" integer NOT NULL REFERENCES "clan_memberships"("id") ON DELETE CASCADE,
  "slot" integer NOT NULL,
  "placed_at" text NOT NULL,
  "level_up" integer,
  "ended_at" text,
  "end_reason" text,
  "reusable_at" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_boosts_user_idx" ON "clan_boosts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_boosts_clan_idx" ON "clan_boosts" ("clan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_boosts_seat_idx" ON "clan_boosts" ("clan_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_boosts_live_slot_unique" ON "clan_boosts" ("user_id", "slot") WHERE "ended_at" IS NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_boost_state" (
  "clan_id" integer PRIMARY KEY NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "level" integer DEFAULT 0 NOT NULL,
  "dropped_at" text,
  "recruiting_line" text,
  "last_recruit_post_at" text,
  "last_recruit_post_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
