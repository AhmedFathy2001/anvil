-- Event Discord servers for co-hosted events (lib/eventDiscord).
--
-- discord_layout decides where an event's Discord lives:
--   own    — the host's bound server only (lib/discord-teams, unchanged behaviour)
--   joint  — a separate event server with one role per team + shared text/voice; each clan's private
--            planning channels live in that clan's OWN server, so neither side can read the other's plan
--   single — one server (new, or either clan's) holds everything: team roles, shared channels and
--            private per-team planning channels
-- event_guild_clan_id is the clan whose bot drives the event server (the clan whose admin proved
-- Manage Server on it).
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "discord_layout" text DEFAULT 'own' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_guild_id" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_guild_clan_id" integer REFERENCES "clans"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_guild_category_id" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_guild_text_channel_id" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_guild_voice_channel_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_discord_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"guild_id" text NOT NULL,
	"purpose" text NOT NULL,
	"category_id" text,
	"role_id" text,
	"text_channel_id" text,
	"voice_channel_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_discord_resources_unique" ON "team_discord_resources" ("team_id", "guild_id", "purpose");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_discord_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
	"guild_id" text NOT NULL,
	"discord_id" text NOT NULL,
	"user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"join_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"method" text,
	"dm_status" text DEFAULT 'none' NOT NULL,
	"invite_code" text,
	"invite_expires_at" text,
	"last_checked_at" text,
	"last_error" text,
	"joined_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_discord_members_unique" ON "event_discord_members" ("event_id", "guild_id", "discord_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_discord_members_status_idx" ON "event_discord_members" ("status", "last_checked_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_discord_tokens" (
	"user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" text NOT NULL,
	"scope" text NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
