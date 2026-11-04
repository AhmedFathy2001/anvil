-- EVENT PLAYERS, and a clan's "Streaming" switch. Additive and safe to run twice.
--
-- A third kind of seat beside member and guest: 'event' — somebody who joined ONE streamed event
-- (a creator space's, or a clan's with Streaming on). It lives in clan_memberships like every seat, so
-- sign-ups, teams, scoring and the plugin (all keyed on the seat id) keep working unchanged, but it
-- names the one event it opens (event_id) and is never on the roster, the guest list or the member
-- count. When the event ends the seat closes (left_at) and the row stays as the record of who played.
--
-- One seat per account per clan stays the rule for members and guests. Event seats are one per
-- account per EVENT, so a viewer can play two of a streamer's events without either seat opening the
-- other. Hence the old unique index becomes partial, and event seats get their own.

ALTER TABLE "clan_memberships" ADD COLUMN IF NOT EXISTS "event_id" integer REFERENCES "events"("id") ON DELETE SET NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "clan_memberships_clan_account_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_memberships_clan_account_unique" ON "clan_memberships" USING btree ("clan_id","account_id") WHERE kind <> 'event';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clan_memberships_event_seat_unique" ON "clan_memberships" USING btree ("clan_id","account_id","event_id") WHERE kind = 'event';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_memberships_event_idx" ON "clan_memberships" USING btree ("event_id") WHERE event_id IS NOT NULL;--> statement-breakpoint

-- The roster view carries the seat's event, appended so every existing column keeps its place.
CREATE OR REPLACE VIEW "clan_roster" AS
SELECT m.id,
   m.clan_id,
   m.account_id,
   a.player_id,
   a.rsn,
   a.rsn_normalized,
   a.account_hash,
   a.discord_id,
   m.kind,
   m.rank,
   m.source,
   m.joined_at,
   m.left_at,
   m.last_seen_in_clan,
   m.notes,
   m.pending_role,
   a.previous_rsns,
   a.is_primary,
   a.verified_at,
   a.verification_method,
   a.verified_by_user_id,
   a.provisional,
   a.claimed_at,
   a.status,
   a.status_last_checked,
   a.live_stats,
   a.live_stats_at,
   a.live_stat_key_times,
   a.stats_overall_xp,
   a.stats_miss_streak,
   a.stats_next_due_at,
   s.snapshot AS stats_last_snapshot,
   a.stats_activities,
   m.event_id
  FROM clan_memberships m
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN account_stat_snapshots s ON s.account_id = a.id;--> statement-breakpoint

-- A clan's "Streaming" switch (lib/creatorSpaces streamsEvents): its own events may then be opened to
-- viewers, gated on the clan's Twitch / Kick / YouTube channel. Off = the clan works exactly as before.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "streaming" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- A clan event's "Who can join?": false = members only (today's behaviour, the default); true = viewers
-- may join too, past the event's entry gates, as event players. Ignored unless the clan has Streaming
-- on; a creator space's events are always open to viewers.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "open_to_viewers" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- BACKFILL. A creator space's guest seat that has sign-ups in exactly ONE event becomes that event's
-- event seat — which is all it was ever used for. Seats with sign-ups in several events (or none)
-- stay guests, and so does anybody holding a staff grant in the space (staff play on a guest seat).
-- Only kind='guest' rows are touched, so a second run finds nothing left to change.
UPDATE "clan_memberships" m
   SET "kind" = 'event', "event_id" = one.event_id
  FROM (
    SELECT es.clan_member_id AS seat_id, min(es.event_id) AS event_id
      FROM "event_signups" es
     GROUP BY es.clan_member_id
    HAVING count(DISTINCT es.event_id) = 1
  ) one,
  "clans" c,
  "events" e
 WHERE one.seat_id = m.id
   AND c.id = m.clan_id
   AND c.kind = 'creator'
   AND m.kind = 'guest'
   AND e.id = one.event_id
   AND e.clan_id = m.clan_id
   AND NOT EXISTS (
     SELECT 1
       FROM "clan_staff" cs
       JOIN "users" u ON u.id = cs.user_id
       JOIN "accounts" a ON a.player_id = u.player_id
      WHERE cs.clan_id = m.clan_id AND a.id = m.account_id
   );
