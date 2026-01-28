ALTER TABLE `events` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `events` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `players` ADD `stats_snapshot` text;--> statement-breakpoint
ALTER TABLE `players` ADD `snapshot_at` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `tracked_stat` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `stat_type` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `stat_goal` integer;--> statement-breakpoint
ALTER TABLE `tiles` ADD `tracking_mode` text DEFAULT 'team' NOT NULL;