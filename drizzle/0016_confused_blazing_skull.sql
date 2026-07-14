CREATE TABLE `federation_bans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`reason` text,
	`at` text DEFAULT (datetime('now')) NOT NULL,
	`by_user_id` integer,
	FOREIGN KEY (`by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `federation_bans_discord_id_unique` ON `federation_bans` (`discord_id`);--> statement-breakpoint
CREATE TABLE `federation_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer,
	`discord_id` text,
	`member_id` integer,
	`scopes` text DEFAULT '["board:read"]' NOT NULL,
	`label` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `federation_tokens_token_id_unique` ON `federation_tokens` (`token_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `federation_tokens_token_hash_unique` ON `federation_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `federation_tokens_user_id_idx` ON `federation_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `federation_tokens_discord_id_idx` ON `federation_tokens` (`discord_id`);