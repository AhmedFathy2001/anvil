CREATE TABLE `member_clog` (
	`clan_member_id` integer PRIMARY KEY NOT NULL,
	`pages_synced` integer DEFAULT 0 NOT NULL,
	`pages_total` integer DEFAULT 0 NOT NULL,
	`obtained` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`account_hash` text,
	`synced_at` text NOT NULL,
	`plugin_version` text,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_clog_synced_idx` ON `member_clog` (`synced_at`);--> statement-breakpoint
CREATE TABLE `member_clog_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`page_name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`first_seen_at` text,
	`kc_at_unlock` integer,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_clog_items_unique` ON `member_clog_items` (`clan_member_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `member_clog_items_item_idx` ON `member_clog_items` (`item_id`);--> statement-breakpoint
CREATE INDEX `member_clog_items_page_idx` ON `member_clog_items` (`clan_member_id`,`page_name`);--> statement-breakpoint
CREATE TABLE `member_clog_kc` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`page_name` text NOT NULL,
	`label` text NOT NULL,
	`count` integer NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_clog_kc_unique` ON `member_clog_kc` (`clan_member_id`,`page_name`,`label`);--> statement-breakpoint
CREATE TABLE `member_personal_bests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`activity` text NOT NULL,
	`team_size` integer DEFAULT 0 NOT NULL,
	`centis` integer NOT NULL,
	`achieved_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_pb_unique` ON `member_personal_bests` (`clan_member_id`,`activity`,`team_size`);--> statement-breakpoint
CREATE INDEX `member_pb_activity_idx` ON `member_personal_bests` (`activity`,`centis`);