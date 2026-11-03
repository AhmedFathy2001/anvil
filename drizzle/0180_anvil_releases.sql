-- Anvil releases (lib/releases): the note for each release lives in the repo (releases/<version>.md);
-- a row here means it SHIPPED to production and was announced — #anvil-announcements, clans with an
-- "Anvil updates" webhook, /changelog, and once to each player at their next plugin login. Platform-wide settings
-- (the announcements webhook) get their own small table: `settings` is per clan.
-- Numbered 0180 (0179 is held by clan boosts); IF NOT EXISTS throughout so a re-run is harmless.
CREATE TABLE IF NOT EXISTS "releases" (
  "id" serial PRIMARY KEY NOT NULL,
  "version" text NOT NULL,
  "title" text NOT NULL,
  "note" jsonb NOT NULL,
  "plugin_version" text,
  "published_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "releases_version_unique" ON "releases" ("version");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text,
  "updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seen_release_id" integer;
