CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'moderator' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_by` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `weekly_competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`metric` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_by_id` integer,
	`wom_competition_id` integer,
	`status` text DEFAULT 'upcoming' NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `weekly_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`rsn` text NOT NULL,
	`baseline_value` integer,
	`current_value` integer,
	`last_updated` text,
	FOREIGN KEY (`competition_id`) REFERENCES `weekly_competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_participant_unique` ON `weekly_participants` (`competition_id`,`rsn`);