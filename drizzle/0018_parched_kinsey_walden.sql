CREATE TABLE `federation_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`instance_id` text NOT NULL,
	`base_url` text NOT NULL,
	`name` text,
	`token` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `federation_connections_user_instance_unique` ON `federation_connections` (`user_id`,`instance_id`);--> statement-breakpoint
CREATE INDEX `federation_connections_user_id_idx` ON `federation_connections` (`user_id`);--> statement-breakpoint
CREATE TABLE `federation_device_sessions` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`verification_url` text NOT NULL,
	`interval` integer DEFAULT 5 NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
