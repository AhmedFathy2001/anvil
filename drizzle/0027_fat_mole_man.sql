ALTER TABLE `weekly_participants` ADD `flagged` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_participants` ADD `flag_reason` text;