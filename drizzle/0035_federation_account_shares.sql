CREATE TABLE `federation_account_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`clan_member_id` integer NOT NULL,
	`instance_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `federation_account_shares_unique` ON `federation_account_shares` (`clan_member_id`,`instance_id`);--> statement-breakpoint
CREATE INDEX `federation_account_shares_user_idx` ON `federation_account_shares` (`user_id`);