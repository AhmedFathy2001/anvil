ALTER TABLE `events` ADD `wom_competition_id` integer;--> statement-breakpoint
ALTER TABLE `players` ADD `cached_stats` text;--> statement-breakpoint
ALTER TABLE `players` ADD `last_stats_fetch` text;