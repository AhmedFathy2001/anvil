-- Tile conditions (lib/tileConditions): raid picks with their own bars, and tile-wide rules (nobody
-- dies, teammates inside, the player's count when the event started). JSON; null = no conditions.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "conditions" text;
