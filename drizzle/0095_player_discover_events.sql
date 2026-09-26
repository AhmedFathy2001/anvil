-- Whether a person's apex home shows public boards from clans they are not in ("Open to everyone").
-- On by default; the person turns it off from the section itself.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "discover_events" boolean DEFAULT true NOT NULL;
