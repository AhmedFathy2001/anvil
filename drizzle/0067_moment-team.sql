-- Which team a moment belonged to, so an event recap can attribute a drop to a side.
--
-- The backfill reads event_participants: beta's `players` is this branch's participant table, the
-- name `players` now being the PERSON table.

ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "team_id" integer REFERENCES "teams"("id") ON DELETE set null;

UPDATE "moments" m
   SET "team_id" = p."team_id"
  FROM "event_participants" p
 WHERE p."event_id" = m."event_id"
   AND p."clan_member_id" = m."clan_member_id"
   AND m."event_id" IS NOT NULL
   AND m."team_id" IS NULL;
