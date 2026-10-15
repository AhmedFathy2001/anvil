-- Per (team, open KC/XP tile): each member's gain at the last completion check and the window their
-- latest increase happened in (lib/overshoot), so a completion caps the split at the goal in the order
-- the gains happened. Rows are deleted once the tile completes.
CREATE TABLE IF NOT EXISTS "stat_tile_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
	"tile_id" integer NOT NULL REFERENCES "tiles"("id") ON DELETE cascade,
	"data" text NOT NULL,
	"updated_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stat_tile_progress_team_tile_unique" ON "stat_tile_progress" USING btree ("team_id","tile_id");
