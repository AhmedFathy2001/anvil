-- Extra webhooks for one event's posts (lib/eventWebhooks): fan-out to more channels — another
-- server, a team's own channel — filtered by post kind, and optionally by team.
CREATE TABLE IF NOT EXISTS "event_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"team_id" integer REFERENCES "teams"("id") ON DELETE CASCADE,
	"url" text NOT NULL,
	"label" text,
	"kinds" text DEFAULT '[]' NOT NULL,
	"created_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_webhooks_event_idx" ON "event_webhooks" ("event_id");
