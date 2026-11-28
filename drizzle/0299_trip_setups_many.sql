-- Several saved setups per character and trip (lib/tripSetups): each has an id, a name the player
-- gives it on the site (24 characters at most), a preset tag ("Solo", "CM", "Contract 1"), whether it
-- is the trip's default, whether the clan sees it, and a share link token. The one setup a trip had
-- before becomes that trip's default, named after it. Still OWNER-ONLY: the bank never rides along.
ALTER TABLE "trip_setups" ADD COLUMN IF NOT EXISTS "id" serial;--> statement-breakpoint
ALTER TABLE "trip_setups" ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "trip_setups" ADD COLUMN IF NOT EXISTS "tag" text;--> statement-breakpoint
ALTER TABLE "trip_setups" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "trip_setups" ADD COLUMN IF NOT EXISTS "share_clan" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "trip_setups" ADD COLUMN IF NOT EXISTS "share_token" text;--> statement-breakpoint
UPDATE "trip_setups" SET "is_default" = true, "name" = left(coalesce(nullif(btrim("setup"->>'name'), ''), 'Setup 1'), 24) WHERE "name" = '';--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_name = 'trip_setups' AND constraint_name = 'trip_setups_pkey' AND column_name = 'id'
  ) THEN
    ALTER TABLE "trip_setups" DROP CONSTRAINT IF EXISTS "trip_setups_pkey";
    ALTER TABLE "trip_setups" ADD CONSTRAINT "trip_setups_pkey" PRIMARY KEY ("id");
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_setups_account_content_idx" ON "trip_setups" ("account_id", "content");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trip_setups_default_unique" ON "trip_setups" ("account_id", "content") WHERE "is_default";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trip_setups_share_token_unique" ON "trip_setups" ("share_token") WHERE "share_token" IS NOT NULL;
