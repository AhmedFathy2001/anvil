-- When an event's proof images were deleted under the 90-day retention (lib/eventMediaRetention).
-- The event, its tiles, completions, submissions and who did what are kept; only the stored images
-- go, and their URLs are pointed at /proof-expired.svg so every page shows why instead of a broken
-- image. NULL = not purged (yet).
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "media_purged_at" text;
