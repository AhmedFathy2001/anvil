-- When the daily job last checked a Discord avatar still loads (lib/discordAvatarRefresh): a changed
-- avatar leaves the stored hash pointing at a 404 until the next login. Additive.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discord_avatar_checked_at" text;
