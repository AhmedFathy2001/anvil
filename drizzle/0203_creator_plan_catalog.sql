-- Creator spaces get their own plan catalogue (lib/creatorCatalog), separate from the clan ladder
-- (lib/plans). The value stays in clans.plan, but a creator space now holds creator ids
-- ('creator_free' … 'creator_partner'), so a stored plan names its own catalogue and nothing that
-- reads one ladder can be handed the other's tier.
--
-- Backfill: every creator space keeps the tier it had, in creator terms (the same mapping as
-- lib/creatorCatalog CREATOR_PLAN_FROM_CLAN_PLAN). Anything unrecognised starts at creator free.
UPDATE "clans"
SET "plan" = CASE "plan"
	WHEN 'free' THEN 'creator_free'
	WHEN 'bronze' THEN 'creator_bronze'
	WHEN 'silver' THEN 'creator_silver'
	WHEN 'gold' THEN 'creator_gold'
	WHEN 'custom' THEN 'creator_partner'
	ELSE 'creator_free'
END
WHERE "kind" = 'creator' AND left("plan", 8) <> 'creator_';
--> statement-breakpoint
-- A clan row never holds a creator id, either (none can today; this is for the constraint below).
UPDATE "clans" SET "plan" = 'free' WHERE "kind" <> 'creator' AND left("plan", 8) = 'creator_';
--> statement-breakpoint
-- And from now on the database refuses the mix outright: a creator row on a clan tier, or a clan on a
-- creator tier, is a billing bug that should be impossible, not merely unlikely.
ALTER TABLE "clans" DROP CONSTRAINT IF EXISTS "clans_plan_matches_kind";
--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_plan_matches_kind" CHECK (("kind" = 'creator') = (left("plan", 8) = 'creator_'));
