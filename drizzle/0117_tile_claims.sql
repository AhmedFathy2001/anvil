-- Team-private tile claims (lib/tileClaims): "I'm planning to go for this one". Only the claimer's
-- own teammates ever read these. One row per person per tile per team; user_id is the login that
-- claimed, participant_id the enrolment whose name teammates see.
CREATE TABLE IF NOT EXISTS "tile_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"tile_id" integer NOT NULL REFERENCES "tiles"("id") ON DELETE CASCADE,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"participant_id" integer REFERENCES "event_participants"("id") ON DELETE SET NULL,
	"note" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tile_claims_team_tile_user_unique" ON "tile_claims" ("team_id", "tile_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tile_claims_team_idx" ON "tile_claims" ("team_id");
