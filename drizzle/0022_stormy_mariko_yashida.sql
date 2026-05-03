CREATE TABLE `event_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`clan_member_id` integer NOT NULL,
	`profile_data` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`signed_up_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_signup_user_unique` ON `event_signups` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_signups_event_id_idx` ON `event_signups` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_signups_user_id_idx` ON `event_signups` (`user_id`);--> statement-breakpoint
CREATE INDEX `event_signups_clan_member_id_idx` ON `event_signups` (`clan_member_id`);--> statement-breakpoint
CREATE TABLE `signup_fees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`signup_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`collected_by_user_id` integer,
	`collected_at` text,
	`reported_collector_user_id` integer,
	`reported_at` text,
	`proof_blob_url` text,
	`confirmed_by_user_id` integer,
	`confirmed_at` text,
	`notes` text,
	FOREIGN KEY (`signup_id`) REFERENCES `event_signups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collected_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reported_collector_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signup_fees_signup_unique` ON `signup_fees` (`signup_id`);--> statement-breakpoint
CREATE INDEX `signup_fees_status_idx` ON `signup_fees` (`status`);--> statement-breakpoint
ALTER TABLE `events` ADD `signup_fee` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `signup_opens_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `signup_deadline` text;--> statement-breakpoint
ALTER TABLE `events` ADD `captain_selection_deadline` text;