-- PLATFORM REPORTS (lib/platformReports): the creator-page report queue (0211's promo_reports)
-- becomes the one queue for everything a signed-in viewer can report to Anvil staff — a creator space,
-- a creator panel, a clan, an event, a player profile (character or person) or a stream highlight.
-- Additive: the table keeps its name and every existing row keeps its meaning.
--
--   target_type  'space' | 'creator_panel' | 'clan' | 'event' | 'character' | 'person' | 'highlight'
--   target_id    the reported thing's id in its own table (space/clan → clans, creator_panel →
--                space_panels, event → events, character → accounts, person → players,
--                highlight → stream_highlights)
--   category     the reporter's chosen reason (lib/platformReportRules REPORT_CATEGORIES)
--   reason       (unchanged) the reporter's optional note
--   staff_note   platform staff's own note on the report
--
-- clan_id stops being required: a player profile belongs to no clan.

ALTER TABLE "promo_reports" ADD COLUMN IF NOT EXISTS "target_type" text DEFAULT 'space' NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_reports" ADD COLUMN IF NOT EXISTS "target_id" integer;--> statement-breakpoint
ALTER TABLE "promo_reports" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "promo_reports" ADD COLUMN IF NOT EXISTS "staff_note" text;--> statement-breakpoint
ALTER TABLE "promo_reports" ALTER COLUMN "clan_id" DROP NOT NULL;--> statement-breakpoint

-- The rows 0211 wrote: a panel report, or the page as a whole.
UPDATE "promo_reports" SET "target_type" = 'creator_panel', "target_id" = "panel_id"
  WHERE "panel_id" IS NOT NULL AND "target_id" IS NULL;--> statement-breakpoint
UPDATE "promo_reports" SET "target_id" = "clan_id"
  WHERE "panel_id" IS NULL AND "target_id" IS NULL;--> statement-breakpoint
UPDATE "promo_reports" SET "category" = 'other' WHERE "category" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "promo_reports_target_idx" ON "promo_reports" USING btree ("target_type","target_id","status");--> statement-breakpoint

-- A stream highlight platform staff took down from a report. Hidden highlights never render
-- (lib/highlights/store shown()); the host cannot undo it.
ALTER TABLE "stream_highlights" ADD COLUMN IF NOT EXISTS "staff_hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stream_highlights" ADD COLUMN IF NOT EXISTS "staff_hidden_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
