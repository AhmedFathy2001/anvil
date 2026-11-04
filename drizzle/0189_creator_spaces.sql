-- Creator spaces: a streamer's home for hosting events with no in-game OSRS clan behind it.
-- 'clan' (every existing row, and the default) | 'creator'. IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'clan' NOT NULL;
