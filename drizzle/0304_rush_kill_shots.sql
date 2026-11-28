-- Boss Rush: screenshots of kills the hiscores cannot vouch for (1st and every 25th at a target the
-- hiscores do not keep). Evidence for staff, purged with the rush's other images. Additive.
CREATE TABLE IF NOT EXISTS "rush_kill_shots" (
  "id" serial PRIMARY KEY NOT NULL,
  "competition_id" integer NOT NULL REFERENCES "weekly_competitions"("id") ON DELETE cascade,
  "participant_id" integer NOT NULL REFERENCES "weekly_participants"("id") ON DELETE cascade,
  "clan_member_id" integer REFERENCES "clan_memberships"("id") ON DELETE set null,
  "target" text NOT NULL,
  "kill_number" integer NOT NULL,
  "occurred_at" text NOT NULL,
  "proof_key" text,
  "screenshot_url" text,
  "clean_screenshot_url" text,
  "created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rush_kill_shots_comp_idx" ON "rush_kill_shots" USING btree ("competition_id","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rush_kill_shots_proof_key_unique" ON "rush_kill_shots" USING btree ("proof_key") WHERE proof_key is not null;
