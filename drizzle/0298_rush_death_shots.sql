-- Boss Rush: one row per counted death, holding its screenshot (lib/itemHuntDb recordRushDeath,
-- lib/huntDropPosts huntProofUpload). Pictures are purged 90 days after the rush ends. Additive.
CREATE TABLE IF NOT EXISTS "rush_death_shots" (
  "id" serial PRIMARY KEY NOT NULL,
  "competition_id" integer NOT NULL REFERENCES "weekly_competitions"("id") ON DELETE cascade,
  "participant_id" integer NOT NULL REFERENCES "weekly_participants"("id") ON DELETE cascade,
  "clan_member_id" integer REFERENCES "clan_memberships"("id") ON DELETE set null,
  "occurred_at" text NOT NULL,
  "source" text,
  "proof_key" text,
  "screenshot_url" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rush_death_shots_comp_idx" ON "rush_death_shots" USING btree ("competition_id","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rush_death_shots_proof_key_unique" ON "rush_death_shots" USING btree ("proof_key") WHERE proof_key is not null;
