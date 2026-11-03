-- The event chat in the plugin's Feed tab (lib/eventChat): a host switch and a pause on each event,
-- the messages, and who is muted. IF NOT EXISTS throughout so a re-run is harmless.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "chat_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "chat_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_chat_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "team_id" integer REFERENCES "teams"("id") ON DELETE set null,
  "team_only" boolean DEFAULT false NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "from_staff" boolean DEFAULT false NOT NULL,
  "rsn" text NOT NULL,
  "body" text NOT NULL,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  "deleted_at" text,
  "deleted_by" integer REFERENCES "users"("id") ON DELETE set null
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_chat_messages_event_idx" ON "event_chat_messages" ("event_id", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_chat_messages_team_idx" ON "event_chat_messages" ("event_id", "team_id", "id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_chat_mutes" (
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "until" text,
  "by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
  CONSTRAINT "event_chat_mutes_event_id_user_id_pk" PRIMARY KEY ("event_id", "user_id")
);
