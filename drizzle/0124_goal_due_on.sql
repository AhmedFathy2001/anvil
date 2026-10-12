-- An optional deadline on a goal (YYYY-MM-DD): "99 Slayer by 1 December". Text like every other date
-- here; null = no deadline.
ALTER TABLE "player_goals" ADD COLUMN IF NOT EXISTS "due_on" text;
