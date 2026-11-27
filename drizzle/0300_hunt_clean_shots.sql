-- Item hunt / Boss Rush screenshots are stamped by the site like bingo proofs (lib/huntStamp): the
-- stamped image stays in screenshot_url, the plugin's untouched frame is kept here. Purged with the
-- stamped one 90 days after the competition ends (lib/huntMediaRetention). Additive, nullable.
ALTER TABLE "hunt_drops" ADD COLUMN IF NOT EXISTS "clean_screenshot_url" text;--> statement-breakpoint
ALTER TABLE "rush_death_shots" ADD COLUMN IF NOT EXISTS "clean_screenshot_url" text;
