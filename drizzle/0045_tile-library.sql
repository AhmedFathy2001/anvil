CREATE TABLE `tile_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`tile_type` text DEFAULT 'standard' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`category` text,
	`config` text NOT NULL,
	`seed_key` text,
	`source_event_id` integer,
	`created_by_user_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tile_library_points_idx` ON `tile_library` (`points`);--> statement-breakpoint
CREATE INDEX `tile_library_category_idx` ON `tile_library` (`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `tile_library_seed_key_idx` ON `tile_library` (`seed_key`);