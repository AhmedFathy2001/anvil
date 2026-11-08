-- Team competitions for weekly (SOTW/BOTW/custom) competitions — lib/competitionTeams.
-- mode: 'solo' (default, unchanged behaviour) | 'teams' (split into teams, team totals ranked) |
-- 'clans' (clan vs clan: host + clans that accepted an invite, clan totals ranked).
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'solo' NOT NULL;
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "team_late_join" boolean DEFAULT true NOT NULL;
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "halfway_posted_at" text;
CREATE TABLE IF NOT EXISTS "weekly_competition_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"name" text NOT NULL,
	"colour" text DEFAULT '#d4a017' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "weekly_competition_teams_competition_id_weekly_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."weekly_competitions"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "weekly_competition_teams_comp_idx" ON "weekly_competition_teams" USING btree ("competition_id");
CREATE TABLE IF NOT EXISTS "weekly_competition_clans" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"clan_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" integer,
	"decided_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"decided_at" text,
	CONSTRAINT "weekly_competition_clans_competition_id_weekly_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."weekly_competitions"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "weekly_competition_clans_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "weekly_competition_clans_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "weekly_competition_clans_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_competition_clans_comp_clan_unique" ON "weekly_competition_clans" USING btree ("competition_id","clan_id");
CREATE INDEX IF NOT EXISTS "weekly_competition_clans_clan_status_idx" ON "weekly_competition_clans" USING btree ("clan_id","status");
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "team_id" integer;
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "clan_id" integer;
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "gain_at" text;
DO $$ BEGIN
  ALTER TABLE "weekly_participants" ADD CONSTRAINT "weekly_participants_team_id_weekly_competition_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."weekly_competition_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "weekly_participants" ADD CONSTRAINT "weekly_participants_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "weekly_participants_team_idx" ON "weekly_participants" USING btree ("team_id");
