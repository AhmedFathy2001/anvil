-- Combo tiles (lib/combo) + per-member counter caps (lib/tileCaps). Replaces the unshipped either/or
-- alt_goal column; the DROP only cleans a dev database that ran the earlier draft of this migration.
-- Its journal `when` sits BETWEEN 0161 and the reserved 0162/0163 on purpose: drizzle's migrator only
-- applies a migration whose `when` is newer than the last one a database ran, so a 0164 stamped after
-- 0162/0163 would make them silently skipped wherever this landed first. Every statement is
-- IF [NOT] EXISTS, so a dev database that ran the earlier draft can run this file by hand.
ALTER TABLE "tiles" DROP COLUMN IF EXISTS "alt_goal";--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "parent_tile_id" integer REFERENCES "tiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "combo_rule" text;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "combo_weight" real;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "cap_by" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tiles_parent_tile_id_idx" ON "tiles" ("parent_tile_id");--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "goal" text;
