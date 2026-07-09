PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer,
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
INSERT INTO `__new_event_signups`("id", "event_id", "user_id", "clan_member_id", "profile_data", "status", "signed_up_at", "updated_at") SELECT "id", "event_id", "user_id", "clan_member_id", "profile_data", "status", "signed_up_at", "updated_at" FROM `event_signups`;--> statement-breakpoint
DROP TABLE `event_signups`;--> statement-breakpoint
ALTER TABLE `__new_event_signups` RENAME TO `event_signups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `event_signup_user_unique` ON `event_signups` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_signups_event_id_idx` ON `event_signups` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_signups_user_id_idx` ON `event_signups` (`user_id`);--> statement-breakpoint
CREATE INDEX `event_signups_clan_member_id_idx` ON `event_signups` (`clan_member_id`);