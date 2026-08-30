-- One participant row per ACCOUNT per event — enforced, not merely intended.
--
-- `event_participants.clan_member_id` is a SEAT: (clan, account). While one deployment served one
-- clan that was a faithful stand-in for the person, because an account had exactly one seat. Putting
-- clans on one platform separates the two facts. An account holds a member seat in its own clan and
-- a guest seat in whichever clan is hosting, so the two doors onto a co-hosted board — entering it
-- yourself, and a co-host's staff rostering their own members — mint two DIFFERENT seat ids for one
-- human. Nine code paths insert into this table and every one de-duplicated on the seat, so both
-- doors could seat the same person twice: doubled stat gains, two roster rows, two fees owed.
--
-- The account is the thing that must not appear twice. The index below is what makes that a rule of
-- the database rather than a habit of nine call sites.
ALTER TABLE "event_participants"
  ADD COLUMN IF NOT EXISTS "account_id" integer REFERENCES "accounts"("id") ON DELETE SET NULL;
--> statement-breakpoint
-- Every existing row already knows its account, one join away through the seat it was created with.
UPDATE "event_participants" p
SET "account_id" = m."account_id"
FROM "clan_memberships" m
WHERE p."clan_member_id" = m."id"
  AND p."account_id" IS NULL;
--> statement-breakpoint
-- Refuse to continue with a clear account of what is wrong, rather than letting CREATE UNIQUE INDEX
-- fail with a message that names only the index. A violation here means real duplicate players on a
-- real board, and whoever runs this needs to know WHICH before deciding what to merge.
--
-- Expected to find nothing: duplicates are only reachable through cross-clan entry, which no clan
-- has run yet. It is here because a migration that silently deleted rows to satisfy a constraint
-- would be a much worse thing to have written.
DO $$
DECLARE dupes text;
BEGIN
  SELECT string_agg(format('event %s / account %s (%s rows)', event_id, account_id, n), '; ')
    INTO dupes
    FROM (
      SELECT event_id, account_id, count(*) AS n
        FROM "event_participants"
       WHERE account_id IS NOT NULL
       GROUP BY event_id, account_id
      HAVING count(*) > 1
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'event_participants holds the same account twice on one event: %. Merge each pair by hand — keep the row carrying the team and the submissions — then run this again.',
      dupes;
  END IF;
END $$;
--> statement-breakpoint
-- Partial, so any number of rows with no account yet can coexist: a participant outlives the seat it
-- was made from (clan_member_id is ON DELETE SET NULL for the same reason), and one unseated row
-- must not block the next.
CREATE UNIQUE INDEX IF NOT EXISTS "event_participants_event_account_unique"
  ON "event_participants" ("event_id", "account_id")
  WHERE "account_id" IS NOT NULL;
