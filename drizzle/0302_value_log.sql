-- Item hunts / Boss Rushes: when each stat gain was seen, so a rush scores in time order (a death
-- only takes the points held at that moment). Additive.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "value_log" jsonb;
