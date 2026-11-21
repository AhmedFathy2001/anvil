-- Competitions: a Discord role to ping when one starts and/or ends.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "ping_role_id" text;
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "ping_on_start" boolean DEFAULT false NOT NULL;
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "ping_on_end" boolean DEFAULT false NOT NULL;
