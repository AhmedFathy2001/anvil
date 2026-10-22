-- A mission's stat tile counts from when it was announced, not from the event start: each player's
-- standing on the tile's stat is captured at the announce (lib/revealStats). Expand-only; existing
-- tiles stay NULL and keep counting from the event baseline.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "reveal_stats" text;
