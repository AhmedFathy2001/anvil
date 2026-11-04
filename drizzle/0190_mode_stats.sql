-- KC / XP a game-mode world (Leagues, Deadman, hardcore, …) pushed for a board that counts that mode
-- (rules.worldModes; lib/modeStats). Board-row only: a separate save never touches account data.
-- IF NOT EXISTS so a re-run is harmless.
ALTER TABLE "event_participants" ADD COLUMN IF NOT EXISTS "mode_stats" text;
