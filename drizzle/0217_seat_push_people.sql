-- Seating someone on a board (or taking them off, or moving their team) now reaches THEIR plugin at
-- once. The 0149 triggers already announced it on 'anvil_push', but only to clients listening on that
-- board — and a player who was just seated isn't one yet: their ticket was signed before the seat
-- existed, so their chat and Feed rows only started arriving after the next config poll (minutes).
--
-- The payload gains p: the people (users) holding the seat's character. The push hub drops those
-- people's sockets with the roster-changed close code (4001), and every plugin with the live push
-- re-tickets at once on that code — the new ticket covers the new board and team.
--
-- Same function as 0149, plus p; the triggers themselves are unchanged (0149 already fires on
-- event_participants INSERT/DELETE and on a team change).
CREATE OR REPLACE FUNCTION anvil_push_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r record;
  ev integer;
  tm integer;
  tl integer;
  left_team integer;
  people integer[];
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
    -- Seated, unseated, or moved: the seat's own people re-ticket wherever they're listening.
    IF r.account_id IS NOT NULL AND (TG_OP <> 'UPDATE' OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
      SELECT array_agg(u.id) INTO people FROM accounts a JOIN users u ON u.player_id = a.player_id WHERE a.id = r.account_id;
    END IF;
  ELSE
    -- submissions, completions: the team's own change, on one tile.
    tm := r.team_id;
    tl := r.tile_id;
    SELECT t.event_id INTO ev FROM tiles t WHERE t.id = r.tile_id;
  END IF;
  -- A cascade from a deleted tile/event finds no parent; that delete announces itself.
  IF ev IS NOT NULL THEN
    PERFORM pg_notify('anvil_push', json_build_object('k', TG_TABLE_NAME, 'e', ev, 't', tm, 'i', tl, 'x', left_team, 'p', people)::text);
  END IF;
  RETURN NULL;
END
$$;
