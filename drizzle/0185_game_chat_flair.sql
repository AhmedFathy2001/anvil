-- Supporter flair on names in normal game chat (lib/supporter gameChatFlair). Default on; a toggle on
-- the Supporter section turns it off. IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "game_chat_flair" boolean DEFAULT true NOT NULL;
