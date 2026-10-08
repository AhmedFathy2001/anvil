-- Editable event-specific Discord rules copy, plus the webhook message ids needed to update the
-- existing host/co-host posts instead of stacking a fresh copy every time staff make a correction.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "rules_message" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "rules_message_ids" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- Adopt the two rules posts made just before this tracking existed. This is deliberately an exact,
-- one-row data backfill: the newest not-started AFK Spot vs LFL board, with The AFK Spot as host and
-- LFL holding an accepted co-host seat. A different installation/event is a no-op.
WITH existing_rules_post AS (
  SELECT e.id, e.clan_id AS host_clan_id, ec.clan_id AS cohost_clan_id
  FROM events e
  JOIN clans host ON host.id = e.clan_id
  JOIN event_cohosts ec ON ec.event_id = e.id AND ec.status = 'accepted'
  JOIN clans cohost ON cohost.id = ec.clan_id
  WHERE lower(e.name) = 'the afk spot vs lfl'
    AND lower(host.name) = 'the afk spot'
    AND lower(cohost.name) = 'lfl'
    AND e.start_notified = 0
  ORDER BY e.id DESC
  LIMIT 1
)
UPDATE events e
SET rules_message_ids = e.rules_message_ids || jsonb_build_object(
  existing_rules_post.host_clan_id::text, '1557472003844350024',
  existing_rules_post.cohost_clan_id::text, '1557472003823501347'
)
FROM existing_rules_post
WHERE e.id = existing_rules_post.id;
