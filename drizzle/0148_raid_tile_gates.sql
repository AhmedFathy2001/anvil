-- ToA raid level floor on timed/deathless tiles, and the deathless "whole party from the team" rule.
-- Expand-only: existing tiles stay NULL and keep counting any level / any party.
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "min_raid_level" integer;--> statement-breakpoint
ALTER TABLE "tiles" ADD COLUMN IF NOT EXISTS "party_team_only" integer;
