-- Co-hosts' tile access per action (suggest / create / edit / delete) and the suggestions queue. Expand-only; empty access reads from staff_can_edit_board.
ALTER TABLE "event_cohosts" ADD COLUMN IF NOT EXISTS "board_access" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tile_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
	"user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"title" text NOT NULL,
	"details" text,
	"points" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"tile_id" integer REFERENCES "tiles"("id") ON DELETE SET NULL,
	"decided_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tile_suggestions_event_status_idx" ON "tile_suggestions" USING btree ("event_id","status");
