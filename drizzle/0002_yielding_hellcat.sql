CREATE TABLE `detected_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`rsn` text NOT NULL,
	`rsn_normalized` text NOT NULL,
	`account_hash` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`detected_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `detected_accounts_user_rsn_unique` ON `detected_accounts` (`user_id`,`rsn_normalized`);--> statement-breakpoint
CREATE INDEX `detected_accounts_user_id_idx` ON `detected_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `detected_accounts_status_idx` ON `detected_accounts` (`status`);