-- Item hunt drops on Discord (lib/huntDropPosts): each counted drop is posted once, as it happens.
--   posted_at           claimed before the post goes, so a drop is never posted twice
--   discord_message_id  the post, so the plugin's screenshot can be added to it when it lands
--   proof_key           the key a plugin drop's screenshot is uploaded under (POST /api/plugin/facts/proof);
--                       a one-way tombstone once used. The picture is a bonus: nothing waits for it.
ALTER TABLE "hunt_drops" ADD COLUMN IF NOT EXISTS "posted_at" text;
--> statement-breakpoint
ALTER TABLE "hunt_drops" ADD COLUMN IF NOT EXISTS "discord_message_id" text;
--> statement-breakpoint
ALTER TABLE "hunt_drops" ADD COLUMN IF NOT EXISTS "proof_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hunt_drops_proof_key_unique" ON "hunt_drops" ("proof_key") WHERE "proof_key" IS NOT NULL;
