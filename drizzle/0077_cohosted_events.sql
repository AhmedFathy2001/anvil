-- Co-hosted events: the first-class co-host relationship, and who holds the cash.
--
-- event_cohosts is one clan helping run another's event — invite → accept provisions a team (tagged
-- with the co-host's clan) + staff seats for its admins. The host keeps final authority; a co-host
-- runs only its own team. cash_policy on the event decides where the money sits.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cash_policy" text DEFAULT 'host-holds' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_cohosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"status" text DEFAULT 'pending' NOT NULL,
	"team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
	"invited_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"accepted_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"decided_at" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_cohosts_event_clan_unique" ON "event_cohosts" ("event_id", "clan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_cohosts_clan_status_idx" ON "event_cohosts" ("clan_id", "status");
