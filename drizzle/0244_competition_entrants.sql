-- Team competitions, entrants and opt-out (lib/competitionTeamsDb). Each racing clan enters 'all'
-- its members or 'selected' people; every player may opt out of one competition.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "host_entrants" text DEFAULT 'all' NOT NULL;
ALTER TABLE "weekly_competition_clans" ADD COLUMN IF NOT EXISTS "entrants" text DEFAULT 'all' NOT NULL;
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "opted_out" boolean DEFAULT false NOT NULL;
-- Anti-spam invite blocking (lib/clanBlocks).
CREATE TABLE IF NOT EXISTS "clan_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL,
	"blocked_clan_id" integer NOT NULL,
	"blocked_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "clan_blocks_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clan_blocks_blocked_clan_id_clans_id_fk" FOREIGN KEY ("blocked_clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clan_blocks_blocked_by_user_id_users_id_fk" FOREIGN KEY ("blocked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "clan_blocks_pair_unique" ON "clan_blocks" USING btree ("clan_id","blocked_clan_id");
CREATE INDEX IF NOT EXISTS "clan_blocks_blocked_idx" ON "clan_blocks" USING btree ("blocked_clan_id");
