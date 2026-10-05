-- Event entries carry a name of their own (boards, Discord posts, co-op matching by teammates'
-- reported names). Before lib/characterRename, a rename updated the character but never the entry,
-- so renamed players showed — and co-op-matched — under their old name. Re-sync the name of every
-- entry on a live or upcoming event to its character's current one. Idempotent; finished events are
-- left as the record of who they were.
UPDATE "event_participants" AS ep
SET "name" = a."rsn"
FROM "accounts" AS a, "events" AS e
WHERE e."id" = ep."event_id"
  AND a."id" = COALESCE(
    ep."account_id",
    (SELECT cm."account_id" FROM "clan_memberships" AS cm WHERE cm."id" = ep."clan_member_id")
  )
  AND ep."name" IS DISTINCT FROM a."rsn"
  AND e."force_ended_at" IS NULL
  AND (e."end_date" IS NULL OR e."end_date" > to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS'));
