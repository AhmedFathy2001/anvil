-- Integrity signals: pre-event PBs per participant + per-event network sightings (opt-in). Expand-only.
ALTER TABLE "event_participants" ADD COLUMN IF NOT EXISTS "pb_baseline" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrity_network" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"participant_id" integer NOT NULL REFERENCES "event_participants"("id") ON DELETE CASCADE,
	"net_hash" text NOT NULL,
	"country" text,
	"first_seen_at" text NOT NULL,
	"last_seen_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integrity_network_unique" ON "integrity_network" USING btree ("event_id","participant_id","net_hash");
