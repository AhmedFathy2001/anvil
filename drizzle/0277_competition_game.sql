-- Competitions: which game counts, and what prizes are paid in (lib/competitionGame).
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "counts_on" text DEFAULT 'main' NOT NULL;
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "prize_currency" text DEFAULT 'gp' NOT NULL;
-- The hiscores table a participant is scored from (null = main game), and when it left that save.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "hiscores_table" text;
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "stopped_at" text;
-- The coffer's pot: 'gp' (main game) or 'hcw' (a Hardcore Worlds coffer kept by hand).
ALTER TABLE "coffer_entries" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'gp' NOT NULL;
