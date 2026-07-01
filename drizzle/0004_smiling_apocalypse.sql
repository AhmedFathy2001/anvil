CREATE TABLE `event_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	`scoring_mode` text NOT NULL,
	`board_size` integer NOT NULL,
	`tiles` text,
	`created_by_user_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `event_presets_created_at_idx` ON `event_presets` (`created_at`);