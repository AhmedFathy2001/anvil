-- Live push to the plugin (push/server.ts): every write that can move what a plugin shows announces
-- itself on NOTIFY 'anvil_push' as {k: table, e: event, t: team, i: tile}. Catching it at the table
-- means every write path — plugin routes, admin edits, crons, staff tools — is heard without each
-- one remembering to say so. Additive only: nothing reads or blocks on it, and with no listener
-- connected a NOTIFY is dropped for free.
--
-- event_participants only speaks up for what a plugin shows (team, name, member, cached stats), not
-- for bookkeeping like lastStatsFetch, which every sweep rewrites.
--
-- tiles leave i NULL: a bulk import is one event-wide change (identical payloads in one transaction
-- collapse to one NOTIFY), and a tile's own edit refetches the board anyway. UPDATEs that change
-- nothing don't fire (the WHEN guard), so a cron rewriting a row with the same values stays quiet.
CREATE OR REPLACE FUNCTION anvil_push_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r record;
  ev integer;
  tm integer;
  tl integer;
  left_team integer;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_TABLE_NAME = 'events' THEN
    ev := r.id;
  ELSIF TG_TABLE_NAME IN ('tiles', 'teams') THEN
    ev := r.event_id;
  ELSIF TG_TABLE_NAME = 'event_participants' THEN
    ev := r.event_id;
    -- A sweep refreshing someone's stats moves their team's stat tiles; a draft pick or rename moves
    -- the whole board.
    IF TG_OP = 'UPDATE' AND OLD.team_id IS NOT DISTINCT FROM NEW.team_id AND OLD.name IS NOT DISTINCT FROM NEW.name THEN
      tm := r.team_id;
    END IF;
    -- Somebody left a team (removed, or moved to another): x names it, and that team's listeners
    -- re-ticket so nobody keeps hearing a team they're no longer on. A pick from the pool (no team
    -- before) takes nothing from anyone, so it doesn't.
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
      left_team := OLD.team_id;
    END IF;
  ELSE
    -- submissions, completions: the team's own change, on one tile.
    tm := r.team_id;
    tl := r.tile_id;
    SELECT t.event_id INTO ev FROM tiles t WHERE t.id = r.tile_id;
  END IF;
  -- A cascade from a deleted tile/event finds no parent; that delete announces itself.
  IF ev IS NOT NULL THEN
    PERFORM pg_notify('anvil_push', json_build_object('k', TG_TABLE_NAME, 'e', ev, 't', tm, 'i', tl, 'x', left_team)::text);
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_ins_del ON submissions;--> statement-breakpoint
CREATE TRIGGER anvil_push_ins_del AFTER INSERT OR DELETE ON submissions FOR EACH ROW EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_upd ON submissions;--> statement-breakpoint
CREATE TRIGGER anvil_push_upd AFTER UPDATE ON submissions FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_ins_del ON completions;--> statement-breakpoint
CREATE TRIGGER anvil_push_ins_del AFTER INSERT OR DELETE ON completions FOR EACH ROW EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_upd ON completions;--> statement-breakpoint
CREATE TRIGGER anvil_push_upd AFTER UPDATE ON completions FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_ins_del ON tiles;--> statement-breakpoint
CREATE TRIGGER anvil_push_ins_del AFTER INSERT OR DELETE ON tiles FOR EACH ROW EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_upd ON tiles;--> statement-breakpoint
CREATE TRIGGER anvil_push_upd AFTER UPDATE ON tiles FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_ins_del ON teams;--> statement-breakpoint
CREATE TRIGGER anvil_push_ins_del AFTER INSERT OR DELETE ON teams FOR EACH ROW EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_upd ON teams;--> statement-breakpoint
CREATE TRIGGER anvil_push_upd AFTER UPDATE ON teams FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_ins_del ON event_participants;--> statement-breakpoint
CREATE TRIGGER anvil_push_ins_del AFTER INSERT OR DELETE ON event_participants FOR EACH ROW EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_upd ON event_participants;--> statement-breakpoint
CREATE TRIGGER anvil_push_upd AFTER UPDATE ON event_participants FOR EACH ROW WHEN (
  OLD.team_id IS DISTINCT FROM NEW.team_id OR OLD.name IS DISTINCT FROM NEW.name
  OR OLD.clan_member_id IS DISTINCT FROM NEW.clan_member_id OR OLD.cached_stats IS DISTINCT FROM NEW.cached_stats
) EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_ins_del ON events;--> statement-breakpoint
CREATE TRIGGER anvil_push_ins_del AFTER INSERT OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION anvil_push_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_push_upd ON events;--> statement-breakpoint
CREATE TRIGGER anvil_push_upd AFTER UPDATE ON events FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION anvil_push_notify();
