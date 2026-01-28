CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`team_id` integer,
	`pick_number` integer,
	`picked_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `events` ADD `draft_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `draft_order` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `icon` text;