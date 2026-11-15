-- A board can count game modes beside (or instead of) the main game; a proof now says which mode it
-- was earned on, so a shared board can show "Hardcore" on it. NULL = main game / web / older rows.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "world_mode" text;
