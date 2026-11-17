-- Tile race easier options (lib/raceEase): a child tile under a board tile that goes live later
-- (timed easing, or a lifeline the team spends). ease_level NULL = not an easier option.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "ease_level" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "race_ease_tick" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "race_lifelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"tile_id" integer NOT NULL REFERENCES "tiles"("id") ON DELETE cascade,
	"used_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
	"used_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "race_lifelines_team_tile_unique" ON "race_lifelines" ("team_id","tile_id");
