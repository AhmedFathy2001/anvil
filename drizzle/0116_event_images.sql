-- An event's own picture (lib/eventImage). Both optional and both our own uploaded media.
--   icon_url   — square; cards, the event header and Discord. Falls back to the host clan's logo,
--                then to the generated crest.
--   banner_url — wide; across the top of the event page and its link preview.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "icon_url" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "banner_url" text;
