ALTER TABLE `clan_members` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `clan_members` ADD `status_last_checked` text;--> statement-breakpoint
CREATE INDEX `clan_members_status_idx` ON `clan_members` (`status`);
