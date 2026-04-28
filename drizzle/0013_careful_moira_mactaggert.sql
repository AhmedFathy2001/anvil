CREATE TABLE `clan_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rsn` text NOT NULL,
	`rsn_normalized` text NOT NULL,
	`discord_id` text,
	`rank` text,
	`is_guest` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	`left_at` text,
	`last_seen_in_clan` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clan_members_rsn_normalized_unique` ON `clan_members` (`rsn_normalized`);--> statement-breakpoint
CREATE INDEX `clan_members_left_at_idx` ON `clan_members` (`left_at`);--> statement-breakpoint
CREATE TABLE `plugin_link_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`code` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_link_codes_code_unique` ON `plugin_link_codes` (`code`);--> statement-breakpoint
CREATE INDEX `plugin_link_codes_user_id_idx` ON `plugin_link_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `plugin_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`rsn` text NOT NULL,
	`rsn_normalized` text NOT NULL,
	`token` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_links_token_unique` ON `plugin_links` (`token`);--> statement-breakpoint
CREATE INDEX `plugin_links_user_id_idx` ON `plugin_links` (`user_id`);