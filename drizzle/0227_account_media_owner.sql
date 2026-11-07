-- Who set a character's own avatar/banner: an override survives only while that person still owns
-- the character (a released or re-claimed character must not keep the previous owner's pictures).
ALTER TABLE "account_media" ADD COLUMN IF NOT EXISTS "owner_player_id" integer;
