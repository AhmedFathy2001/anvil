CREATE TABLE `event_editors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`granted_by_user_id` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_editors_event_user_unique` ON `event_editors` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_editors_user_idx` ON `event_editors` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `editor_scope` text DEFAULT 'all' NOT NULL;