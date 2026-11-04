-- Host-chosen team placement (lib/teamPlacement): auto-balance, players pick, host drafts, or solo.
-- The column default is 'draft' so every existing event keeps exactly today's behaviour; new events
-- get 'auto' from POST /api/events, not from the database. IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "team_placement" text DEFAULT 'draft' NOT NULL;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "team_count" integer;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "team_cap" integer;
