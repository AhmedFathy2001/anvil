-- Combo tiles (lib/combo) + per-member counter caps (lib/tileCaps). Replaces the unshipped either/or
-- alt_goal column; the DROP only cleans a dev database that ran the earlier draft of this migration.
ALTER TABLE "tiles" DROP COLUMN IF EXISTS "alt_goal";--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "parent_tile_id" integer REFERENCES "tiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "combo_rule" text;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "combo_weight" real;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "cap_by" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tiles_parent_tile_id_idx" ON "tiles" ("parent_tile_id");--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "goal" text;
