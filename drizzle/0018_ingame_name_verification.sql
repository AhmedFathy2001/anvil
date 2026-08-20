-- Proving a clan is the clan it says it is.
--
-- The in-game name is the only thing tying a site to a real OSRS clan, and until now anybody could
-- type any name into a settings field. Nothing stopped a stranger claiming a well-known clan's name
-- and standing up a site that looked official — which is impersonation, not a naming clash.
--
-- FIRST, ONE PLACE FOR THE NAME. It lived in two: `clans.in_game_name` and a `clan_ingame_name`
-- setting, and the roster-sync gate read only the setting — so a clan created through the new flow
-- (which writes the column) had NO gate at all and would accept any roster pushed at it. They are
-- consolidated onto the column, because verification has to bind the name and a unique index cannot
-- be expressed over a key/value table.

UPDATE "clans" c
   SET "in_game_name" = s."value"
  FROM "settings" s
 WHERE s."clan_id" = c."id"
   AND s."key" = 'clan_ingame_name'
   AND nullif(trim(s."value"), '') IS NOT NULL
   AND c."in_game_name" IS NULL;

-- ── The badge ────────────────────────────────────────────────────────────────────────────────
--
-- NULL = unverified, which is the normal state for a clan that has just been created. An unverified
-- clan works: boards, guests, events. What it cannot do is sync a roster or enter a cross-clan
-- leaderboard, because both of those are claims about a real clan that nobody has checked.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "ingame_name_verified_at" text;

-- Which ACCOUNT proved it — the one whose in-game rank was owner-tier when the roster was pushed.
-- Kept so a dispute has something to point at besides a timestamp.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "ingame_name_claimed_by_account_id" integer
  REFERENCES "accounts"("id") ON DELETE SET NULL;

-- One VERIFIED clan per in-game name, case-insensitively. First claim wins; a second clan claiming
-- the same name is refused and sent to a human. Partial, so unverified clans can hold whatever
-- placeholder they like without colliding — they have proved nothing, so they reserve nothing.
CREATE UNIQUE INDEX IF NOT EXISTS "clans_verified_ingame_name_unique"
  ON "clans" (lower("in_game_name")) WHERE "ingame_name_verified_at" IS NOT NULL;

-- The two imported clans have been running against real rosters since before any of this existed,
-- which is the strongest evidence available and better than asking their owners to re-prove it.
-- Stamped without an account, because no push recorded one at the time.
UPDATE "clans"
   SET "ingame_name_verified_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
 WHERE "in_game_name" IS NOT NULL
   AND "ingame_name_verified_at" IS NULL
   AND EXISTS (
     -- Only clans with a roster that a plugin actually synced. A clan someone typed a name into but
     -- never synced has proved nothing, and this must not hand it a badge.
     SELECT 1 FROM "clan_memberships" m
      WHERE m."clan_id" = "clans"."id" AND m."source" = 'roster' AND m."left_at" IS NULL
   );
