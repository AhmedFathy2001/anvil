-- Hourly progress rows for the event stats page (schema.ts eventHourSnapshots, lib/eventHourly).
CREATE TABLE IF NOT EXISTS "event_hour_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"hour_index" integer NOT NULL,
	"taken_at" text NOT NULL,
	"data" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_hour_snapshots_event_hour_unique" ON "event_hour_snapshots" ("event_id","hour_index");
