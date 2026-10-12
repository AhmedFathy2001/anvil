-- A clan's wide banner (3:1, e.g. 1500×500) and its vertical focus — the same pair events carry.
-- NULL = no banner (the public page keeps its tinted header) / centred.
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "banner_url" text;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "banner_position" integer;
