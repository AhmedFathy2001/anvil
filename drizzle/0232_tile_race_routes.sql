-- Branching routes for the Tile race format (lib/raceRoutes): each board tile's step (0 = a start)
-- and the tile ids on the next step it leads to. Null everywhere = the classic straight line, so
-- every existing race keeps playing unchanged.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "race_step" integer;
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "race_next" jsonb;
-- "Bank early finishes" (events.rules.raceBank): a finish on a race tile the team hasn't reached
-- yet, kept until its route gets there (lib/raceRoutesDb).
CREATE TABLE IF NOT EXISTS "race_banked_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"tile_id" integer NOT NULL,
	"credit_player_id" integer,
	"banked_at" text NOT NULL,
	CONSTRAINT "race_banked_credits_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "race_banked_credits_tile_id_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."tiles"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "race_banked_credits_credit_player_id_event_participants_id_fk" FOREIGN KEY ("credit_player_id") REFERENCES "public"."event_participants"("id") ON DELETE set null ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "race_banked_credits_team_tile_unique" ON "race_banked_credits" USING btree ("team_id","tile_id");
-- "Choose and lock in" (events.rules.raceRoad = 'choose'): the tile a team picked at a fork, one per
-- step, final once made (lib/raceRoutes).
CREATE TABLE IF NOT EXISTS "race_road_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"step" integer NOT NULL,
	"tile_id" integer NOT NULL,
	"picked_by_user_id" integer,
	"picked_at" text NOT NULL,
	CONSTRAINT "race_road_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "race_road_picks_tile_id_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."tiles"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "race_road_picks_picked_by_user_id_users_id_fk" FOREIGN KEY ("picked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "race_road_picks_team_step_unique" ON "race_road_picks" USING btree ("team_id","step");
