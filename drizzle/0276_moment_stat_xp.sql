-- A pet or drop in a skill competition: the player's XP in that skill when it landed, so the feed and
-- the recap can say "at 13,034,431 XP" the way a boss drop says its kill count. NULL on every other
-- moment and on rows recorded before this.
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "stat_xp" integer;
