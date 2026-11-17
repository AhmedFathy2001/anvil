-- Competition Discord posts (lib/competitionPostsRun): one row per competition per post slot
-- ('day:3', 'ending'). The row is the latch that makes a daily recap or an "ending soon" post go out
-- at most once, and a daily row carries the gains at that moment so the next recap can show what moved.
CREATE TABLE IF NOT EXISTS "weekly_post_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL REFERENCES "weekly_competitions"("id") ON DELETE cascade,
	"slot" text NOT NULL,
	"taken_at" text NOT NULL,
	"data" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_post_slots_comp_slot_unique" ON "weekly_post_slots" ("competition_id","slot");
