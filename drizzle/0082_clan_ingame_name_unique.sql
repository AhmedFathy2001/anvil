-- One clan per in-game name, verified or not.
--
-- There was already a unique index here, but only over rows with `ingame_name_verified_at is not
-- null` -- first VERIFIED claim wins. That left a window: two UNVERIFIED clans could both hold the
-- same name and nothing told either of them until one tried to verify. It is not a naming race.
-- The in-game name is the value roster sync GATES on, so a member list reported by that clan
-- matches both sites, and the clan that did not ask for it has no way to notice.
--
-- It happened on production: "the afk spot" was held by two clans at once.
--
-- Trimmed as well as lowercased, because "The AFK Spot" and "The Afk Spot " are one clan in game,
-- and the sync's own comparison is already case-insensitive.
--
-- CONCURRENTLY is deliberately NOT used: this runs at container start inside the migration
-- transaction, where CREATE INDEX CONCURRENTLY is not allowed. The table holds a handful of rows,
-- so the brief lock costs nothing.
CREATE UNIQUE INDEX IF NOT EXISTS "clans_ingame_name_unique"
  ON "clans" (lower(trim("in_game_name")))
  WHERE "in_game_name" IS NOT NULL AND trim("in_game_name") <> '';
