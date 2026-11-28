-- The per-boss split as the hiscores alone show it, so a Boss Rush checks plugin kills against data the
-- plugin cannot influence (current_parts blends in its live push). Additive.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "hiscores_parts" jsonb;
