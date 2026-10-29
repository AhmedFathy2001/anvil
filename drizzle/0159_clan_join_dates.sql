-- The in-game clan join date per seat, from the roster sync. Expand-only.
ALTER TABLE "clan_memberships" ADD COLUMN IF NOT EXISTS "ingame_joined_on" text;
