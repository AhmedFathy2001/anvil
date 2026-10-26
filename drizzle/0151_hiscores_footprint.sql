-- Hiscores footprint checks + per-player integrity signals (lib/footprint). Expand-only.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "footprint" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrity_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"participant_id" integer NOT NULL REFERENCES "event_participants"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"detail" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"dismissed_at" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integrity_signals_unique" ON "integrity_signals" USING btree ("event_id","participant_id","kind");
