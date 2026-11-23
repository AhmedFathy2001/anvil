-- Practice boards (lib/practice): a clan admin's short test board on real characters. The flag keeps
-- it out of every listing, feed, points table and clan channel; the side table holds its own settings
-- (the test webhook) so whole event rows never carry the URL.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "practice" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_practice_clan_idx" ON "events" ("clan_id") WHERE practice = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_boards" (
  "event_id" integer PRIMARY KEY NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "source_event_id" integer REFERENCES "events"("id") ON DELETE SET NULL,
  "webhook_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_boards_clan_idx" ON "practice_boards" ("clan_id");
