-- Whether a stat tile counts the GAIN during the event or the player's absolute total.

ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "stat_basis" text DEFAULT 'gain' NOT NULL;
