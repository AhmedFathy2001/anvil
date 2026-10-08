-- A withdrawn sign-up is not an event participant. The admin withdrawal path used to remove only
-- unassigned draft-pool rows, leaving pre-assigned clan-v-clan members on the roster and under live
-- tracking. Repair only boards that have not started, and do not remove an account that still has a
-- separate active sign-up on the same event.
DELETE FROM "event_participants" AS participant
USING "event_signups" AS withdrawn,
      "events" AS event,
      "clan_memberships" AS withdrawn_seat
WHERE withdrawn."event_id" = participant."event_id"
  AND withdrawn."status" = 'withdrawn'
  AND withdrawn_seat."id" = withdrawn."clan_member_id"
  AND event."id" = participant."event_id"
  AND (event."start_date" IS NULL OR event."start_date"::timestamptz > now())
  AND (
    participant."clan_member_id" = withdrawn."clan_member_id"
    OR participant."account_id" = withdrawn_seat."account_id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "event_signups" AS active
    INNER JOIN "clan_memberships" AS active_seat
      ON active_seat."id" = active."clan_member_id"
    WHERE active."event_id" = withdrawn."event_id"
      AND active."status" NOT IN ('withdrawn', 'rejected')
      AND active_seat."account_id" = withdrawn_seat."account_id"
  );
