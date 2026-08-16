CREATE TABLE `draft_shortlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`person_key` text NOT NULL,
	`position` integer NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_shortlists_unique` ON `draft_shortlists` (`event_id`,`user_id`,`person_key`);--> statement-breakpoint
CREATE INDEX `draft_shortlists_owner_idx` ON `draft_shortlists` (`event_id`,`user_id`,`position`);