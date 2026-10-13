-- Daily digest + halfway report + hand-marked lottery tiles (schema.ts eventDaySnapshots,
-- events.halfwayNotified, tiles.lottery).
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "lottery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "halfway_notified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_day_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"day_index" integer NOT NULL,
	"taken_at" text NOT NULL,
	"data" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_day_snapshots_event_day_unique" ON "event_day_snapshots" ("event_id","day_index");
