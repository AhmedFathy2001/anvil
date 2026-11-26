-- Boss Rush: points staff add or take off an entrant by hand (a correction, a test), with the reason
-- in the audit log (lib/itemHuntDb adjustRushPoints). Additive.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "rush_adjust" integer DEFAULT 0 NOT NULL;
