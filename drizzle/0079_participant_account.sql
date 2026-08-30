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
--
-- AND IT IS NOT ONLY CROSS-CLAN. The first real database this ran against held a duplicate on ONE
-- seat in ONE clan: two rows, same event, same clan_member_id. There was never a unique constraint
-- on (event_id, clan_member_id) either, so the seat-keyed checks were the only guard against a race,
-- and at least once they lost. Cross-clan play widened an existing hole rather than opening it.
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
-- FIRST, collapse the duplicates that are provably worthless.
--
-- A duplicate is unambiguous when the losing row is on no team, carries no baseline snapshot, and is
-- referenced by nothing — no submission, no completion credit, no starting shot. Such a row is a
-- second pool entry that was never played from; keeping it is not a judgement call and neither is
-- dropping it. The winner is chosen in the order that matters: on a team beats not, having a
-- baseline beats not, and the older row breaks the tie.
--
-- WHY THIS IS NOT PARANOIA. The first real database this ran against had one — same event, same
-- SEAT, two rows — which is worth spelling out because it means the bug predates cross-clan play
-- entirely. There was no unique constraint on (event_id, clan_member_id) either, so the seat-keyed
-- checks in nine call sites were the only thing standing between a race and a duplicate player, and
-- at least once they lost. Refusing every clan's cutover over a row that nothing points at would be
-- the wrong trade.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY event_id, account_id
           ORDER BY (team_id IS NOT NULL) DESC, (stats_snapshot IS NOT NULL) DESC, id ASC
         ) AS rn
    FROM "event_participants"
   WHERE account_id IS NOT NULL
)
DELETE FROM "event_participants" p
 USING ranked r
 WHERE p.id = r.id
   AND r.rn > 1
   AND p.team_id IS NULL
   AND p.stats_snapshot IS NULL
   AND NOT EXISTS (SELECT 1 FROM "submissions" s WHERE s.player_id = p.id OR s.credit_player_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM "completions" c WHERE c.credit_player_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM "event_start_proofs" sp WHERE sp.player_id = p.id);
--> statement-breakpoint
-- THEN refuse, if anything ambiguous is left — with a clear account of what and where, rather than
-- letting CREATE UNIQUE INDEX fail with a message that names only the index. A survivor here is a
-- duplicate where BOTH rows carry something real, and deciding which history to keep is a person's
-- job. A migration that silently deleted one would be a much worse thing to have written.
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
      'event_participants holds the same account twice on one event, and both rows carry real history: %. Merge each pair by hand — keep the row with the team and the submissions — then run this again.',
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
