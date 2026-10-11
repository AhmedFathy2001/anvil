-- Item tiles: "N sets" on collections and "different items only" on drop pools (lib/collectionSets).
-- Both NULL on every existing tile, which reads exactly as before: one set, every drop counts.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "sets_required" integer;
--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "count_mode" text;
