CREATE TABLE `moments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer NOT NULL,
	`rsn` text NOT NULL,
	`kind` text NOT NULL,
	`weekly_competition_id` integer,
	`event_id` integer,
	`item_id` integer,
	`item_name` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`value_gp` integer,
	`source` text,
	`source_kind` text,
	`kc` integer,
	`rarity_denominator` integer,
	`occurred_at` text NOT NULL,
	`noticed_at` text DEFAULT (datetime('now')) NOT NULL,
	`dedup_key` text NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`weekly_competition_id`) REFERENCES `weekly_competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moments_member_dedup_idx` ON `moments` (`clan_member_id`,`dedup_key`);--> statement-breakpoint
CREATE INDEX `moments_weekly_idx` ON `moments` (`weekly_competition_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `moments_event_idx` ON `moments` (`event_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `moments_member_idx` ON `moments` (`clan_member_id`,`occurred_at`);