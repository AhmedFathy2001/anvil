-- Each running weekly's gains as the UTC day began, beside its ranks (lib/rankMoves), so the daily
-- Discord post can say what each player gained since (lib/weeklyDaily). NULL on rows written before.
ALTER TABLE "weekly_day_ranks" ADD COLUMN IF NOT EXISTS "gains" text;
