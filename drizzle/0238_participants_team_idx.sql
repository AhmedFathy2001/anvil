-- Team-only reads of event_participants (the plugin board poll's member names, combo "mix" parts,
-- team chat recipients, clog tile credit, submissions) filter on team_id alone, which
-- players_event_team_idx (event_id, team_id) can't serve. Small table; a plain build is fine.
CREATE INDEX IF NOT EXISTS "players_team_id_idx" ON "event_participants" ("team_id");
