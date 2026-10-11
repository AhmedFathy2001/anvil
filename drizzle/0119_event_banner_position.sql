-- Event banner focus (events.banner_position): the vertical part of the banner that shows when the
-- event page's 3:1 frame crops it. NULL = centred, which is what every existing banner does today.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "banner_position" integer;
