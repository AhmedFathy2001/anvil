CREATE TABLE `tile_locks` (
	`tile_id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`username` text NOT NULL,
	`acquired_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`tile_id`) REFERENCES `tiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tiles` ADD `updated_at` text;