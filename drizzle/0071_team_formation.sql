-- How teams form when several clans play one board.
--
-- `event_invites` has always taken a clan OR a person, unique per (event, clan), with no limit of
-- two — so an event addressed to five clans was already expressible and `canSeeEvent` already
-- honoured it. What was missing is what happens once they accept: every team was a drafted team,
-- because a draft was the only way a team had ever formed.
--
-- Two shapes, and a clan picks per event:
--
--   draft     the pool is everyone from every invited clan and captains pick across them. The
--             existing behaviour, and the right one for a social cross-clan event.
--   per_clan  each invited clan is one team. No draft, no captains picking from a rival's roster —
--             your seat decides your team, which is what a rivalry actually means.
--
-- Default 'draft', because that is what every event in existence already is, and a migration should
-- not change what a board that is running right now does.
ALTER TABLE events ADD COLUMN IF NOT EXISTS team_formation text NOT NULL DEFAULT 'draft';

--> statement-breakpoint
-- WHICH CLAN A TEAM IS, when the event is per_clan. NULL for every drafted team, which is every
-- team that exists today — a drafted team is deliberately not any one clan's, even when it happens
-- to be drawn from one.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS clan_id integer REFERENCES clans(id) ON DELETE SET NULL;

--> statement-breakpoint
-- One team per clan per event. The constraint IS the model: a clan cannot be two teams on the same
-- board, and without this a double-accept or a retried request would quietly make it two.
CREATE UNIQUE INDEX IF NOT EXISTS teams_event_clan_unique
  ON teams (event_id, clan_id) WHERE clan_id IS NOT NULL;
