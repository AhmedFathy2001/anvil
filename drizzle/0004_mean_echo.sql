CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tile_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer,
	`credit_player_id` integer,
	`amount` integer DEFAULT 1 NOT NULL,
	`image_url` text,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tile_id`) REFERENCES `tiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`credit_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `players` ADD `player_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `player_token_unique` ON `players` (`player_token`);--> statement-breakpoint
ALTER TABLE `tiles` ADD `description` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `tile_type` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `tiles` ADD `required_amount` integer;