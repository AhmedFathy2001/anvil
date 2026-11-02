ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "alt_goal" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "goal" text;
