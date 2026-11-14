-- "Keep adding new plugin members" stopped at the event's start; hosts of open, clan-wide events
-- expected it to carry on. Their switch: on, the cron keeps adding until the event ENDS. Off by default.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "auto_enroll_late" boolean DEFAULT false NOT NULL;
