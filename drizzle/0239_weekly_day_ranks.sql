-- Each weekly competition's ranks as a UTC day began (lib/rankMoves): one row per competition per
-- day, written once by the lifecycle tick, for the panel's "▲3 today".
CREATE TABLE IF NOT EXISTS "weekly_day_ranks" (
  "id" serial PRIMARY KEY NOT NULL,
  "competition_id" integer NOT NULL REFERENCES "weekly_competitions"("id") ON DELETE CASCADE,
  "day" text NOT NULL,
  "taken_at" text NOT NULL,
  "ranks" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_day_ranks_comp_day_unique" ON "weekly_day_ranks" ("competition_id","day");
