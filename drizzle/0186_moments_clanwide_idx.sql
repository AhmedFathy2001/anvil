-- Clan-wide moments (no board, no week) by age, for the 30-day achievement sweep
-- (lib/momentsStore sweepClanAchievements). IF NOT EXISTS so a re-run is harmless.
CREATE INDEX IF NOT EXISTS "moments_clanwide_idx" ON "moments" USING btree ("occurred_at") WHERE event_id is null and weekly_competition_id is null;
