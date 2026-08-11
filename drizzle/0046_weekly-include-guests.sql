ALTER TABLE `weekly_competitions` ADD `include_guests` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Competitions that predate this column kept the clan-wide `weekly_track_guests` behaviour, which
-- defaulted to EXCLUDING guests. Backfill from that setting so a running comp's roster doesn't
-- silently gain guests on the next catch-up enrollment sweep. New comps default to 1 (included).
UPDATE `weekly_competitions`
SET `include_guests` = 0
WHERE `include_guests` = 1
  AND COALESCE((SELECT `value` FROM `settings` WHERE `key` = 'weekly_track_guests'), 'false') NOT IN ('true', '1');
