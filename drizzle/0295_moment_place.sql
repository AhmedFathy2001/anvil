-- Where a death or drop happened, for analytics (lib/momentPlace): the map region, and inside a raid
-- which raid, its mode, the Tombs raid level and the party size. Additive, nullable.
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "region_id" integer;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "raid" text;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "raid_mode" text;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "raid_level" integer;--> statement-breakpoint
ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "party_size" integer;
