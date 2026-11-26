-- Boss Rush: an item hunt scored as kills + the host's points per drop - deaths (lib/itemHunt rule 'rush').
--   weekly_participants.rush_kc        kills the PLUGIN saw during the rush (never a hiscores jump:
--                                      lib/bossRushRules rushKcStep).
--   weekly_participants.rush_seen      the last count the plugin pushed per boss key, and when, as
--                                      JSON {key: [kc, atMs]}: what the next push is measured from.
--   weekly_participants.rush_deaths    deaths at a rush boss the plugin reported.
--   weekly_participants.rush_death_at  the last one, so one death reported twice counts once.
--   weekly_participants.rush_raids     each raid the plugin saw them finish, [[key, atMs], ...]:
--                                      entrants finishing the same raid together earn Clan Synergy.
-- Additive: nullable or defaulted columns only.
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "rush_kc" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "rush_seen" jsonb;
--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "rush_deaths" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "rush_death_at" text;
--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD COLUMN IF NOT EXISTS "rush_raids" jsonb;
