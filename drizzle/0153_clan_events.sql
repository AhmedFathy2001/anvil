-- Clan events: scheduled, untracked (a boss mass, a hangout) — posted to Discord, shown in the plugin, with RSVPs. Expand-only.
CREATE TABLE IF NOT EXISTS "clan_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"world" integer,
	"icon" text,
	"host" text,
	"starts_at" text NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"repeat_until" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"ping" integer DEFAULT 1 NOT NULL,
	"cancelled_at" text,
	"created_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text,
	"discord_message_ids" jsonb,
	"reminded_for" text,
	"started_for" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_events_clan_idx" ON "clan_events" USING btree ("clan_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clan_event_rsvps" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_event_id" integer NOT NULL REFERENCES "clan_events"("id") ON DELETE CASCADE,
	"occurrence" text NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_event_rsvps_unique" ON "clan_event_rsvps" USING btree ("clan_event_id","occurrence","user_id");
