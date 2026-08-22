CREATE TABLE `member_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_progress_member_key_unique` ON `member_progress` (`clan_member_id`,`key`);--> statement-breakpoint
CREATE INDEX `member_progress_key_idx` ON `member_progress` (`key`);