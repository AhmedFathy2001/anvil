CREATE TABLE `member_daily_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`day` text NOT NULL,
	`overall_xp` integer NOT NULL,
	`ehp_milli` integer DEFAULT 0 NOT NULL,
	`ehb_milli` integer DEFAULT 0 NOT NULL,
	`xp_gained` integer DEFAULT 0 NOT NULL,
	`ehp_milli_gained` integer DEFAULT 0 NOT NULL,
	`ehb_milli_gained` integer DEFAULT 0 NOT NULL,
	`deltas` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_daily_stats_member_day_idx` ON `member_daily_stats` (`clan_member_id`,`day`);--> statement-breakpoint
CREATE INDEX `member_daily_stats_day_idx` ON `member_daily_stats` (`day`);--> statement-breakpoint
CREATE TABLE `member_milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`kind` text NOT NULL,
	`metric` text,
	`threshold` integer NOT NULL,
	`noticed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_milestones_unique` ON `member_milestones` (`clan_member_id`,`kind`,`metric`,`threshold`);--> statement-breakpoint
CREATE INDEX `member_milestones_member_idx` ON `member_milestones` (`clan_member_id`,`noticed_at`);--> statement-breakpoint
ALTER TABLE `clan_members` ADD `stats_overall_xp` integer;--> statement-breakpoint
ALTER TABLE `clan_members` ADD `stats_miss_streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clan_members` ADD `stats_next_due_at` text;--> statement-breakpoint
ALTER TABLE `clan_members` ADD `stats_last_snapshot` text;