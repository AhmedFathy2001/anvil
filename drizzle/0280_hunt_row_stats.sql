-- Item hunts: each row's progress stat (kills at its boss, XP in its skill) at the start and now, per entrant.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "hunt_baseline" jsonb;
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "hunt_current" jsonb;
