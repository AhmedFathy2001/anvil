-- Clan tenure (lib/clanTenure): how long a clan has paid for Anvil without a break. paid_since is
-- when the current unbroken paid run began; paid_ended_at is when it last dropped to free, so a
-- membership taken up again within the grace keeps its run.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "paid_since" text;
--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "paid_ended_at" text;
--> statement-breakpoint
-- Clans paying today: from their first recorded subscription, else when the clan was made.
UPDATE "clans" c SET "paid_since" = COALESCE(
  (SELECT min(a."occurred_at") FROM "clan_audit_log" a WHERE a."clan_id" = c."id" AND a."event_type" = 'billing_subscribed'),
  c."created_at"
)
WHERE c."paid_since" IS NULL AND c."plan" NOT IN ('free', 'creator_free') AND c."gumroad_subscription_id" IS NOT NULL;
