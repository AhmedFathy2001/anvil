-- Discord display name as of the last login (schema.ts users.discordGlobalName): the clan hall
-- matches the server widget's names against it. Filled on each user's next login.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discord_global_name" text;
