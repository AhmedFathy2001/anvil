CREATE TABLE `pending_renames` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`old_rsn` text NOT NULL,
	`new_rsn` text NOT NULL,
	`old_rsn_normalized` text NOT NULL,
	`new_rsn_normalized` text NOT NULL,
	`old_snapshot` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolution` text,
	`submitted_by_user_id` integer,
	`reviewed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pending_renames_status_idx` ON `pending_renames` (`status`);--> statement-breakpoint
CREATE INDEX `pending_renames_member_idx` ON `pending_renames` (`clan_member_id`);--> statement-breakpoint
CREATE TABLE `player_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`captured_at` text DEFAULT (datetime('now')) NOT NULL,
	`payload` text NOT NULL,
	`overall_xp` integer,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_snapshots_member_captured_idx` ON `player_snapshots` (`clan_member_id`,`captured_at`);