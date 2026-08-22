CREATE TABLE `member_progress_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`category` text NOT NULL,
	`payload` text NOT NULL,
	`done_count` integer DEFAULT 0 NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_progress_items_unique` ON `member_progress_items` (`clan_member_id`,`category`);