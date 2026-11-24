-- Item hunt bounties (lib/itemHunt huntBountyClaims): an award for the Nth player to get one item.
-- place stays null on these, so the (competition, place) index never sees them; they have their own.
ALTER TABLE "coffer_entries" ADD COLUMN IF NOT EXISTS "item_id" integer;
--> statement-breakpoint
ALTER TABLE "coffer_entries" ADD COLUMN IF NOT EXISTS "item_place" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffer_entries_weekly_bounty_unique" ON "coffer_entries" ("weekly_competition_id", "item_id", "item_place") WHERE "weekly_competition_id" IS NOT NULL AND "item_id" IS NOT NULL;
