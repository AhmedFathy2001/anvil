-- An uploaded picture for a clan event, shown over the boss/skill icon on the site and in Discord. Expand-only.
ALTER TABLE "clan_events" ADD COLUMN IF NOT EXISTS "image_url" text;
