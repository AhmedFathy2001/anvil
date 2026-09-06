-- Coffer prizes for a Skill or Boss of the Week.
--
-- The same ladder a mission already uses, pointed at a different scoreboard: what first gets, what
-- second gets, and what happens when the pot cannot pay. Null on the competitions played for
-- bragging rights, which is most of them.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "prizes" text;
-- Set once, when a finished competition's prizes have been reserved. The settle pass runs on every
-- tick over every finished competition; without this the second pass mints a second set of awards.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "prizes_settled_at" text;

ALTER TABLE "coffer_entries" ADD COLUMN IF NOT EXISTS "weekly_competition_id" integer;
DO $$
BEGIN
  ALTER TABLE "coffer_entries"
    ADD CONSTRAINT "coffer_entries_weekly_competition_id_fk"
    FOREIGN KEY ("weekly_competition_id") REFERENCES "weekly_competitions"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One award per (competition, place): a weekly prize has no completion to key on, and belt-and-
-- braces against a settle pass that runs twice.
CREATE UNIQUE INDEX IF NOT EXISTS "coffer_entries_weekly_place_unique"
  ON "coffer_entries" ("weekly_competition_id", "place")
  WHERE "weekly_competition_id" IS NOT NULL;
