CREATE TABLE `plugin_device_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_code_hash` text NOT NULL,
	`user_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_id` integer,
	`interval` integer DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	`last_polled_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_device_codes_hash_unique` ON `plugin_device_codes` (`device_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_device_codes_user_code_unique` ON `plugin_device_codes` (`user_code`);--> statement-breakpoint
CREATE INDEX `plugin_device_codes_expires_idx` ON `plugin_device_codes` (`expires_at`);