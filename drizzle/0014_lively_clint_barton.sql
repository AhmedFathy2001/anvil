ALTER TABLE `players` ADD `clan_member_id` integer REFERENCES clan_members(id);--> statement-breakpoint
CREATE INDEX `players_clan_member_id_idx` ON `players` (`clan_member_id`);--> statement-breakpoint
ALTER TABLE `weekly_participants` ADD `clan_member_id` integer REFERENCES clan_members(id);--> statement-breakpoint
CREATE INDEX `weekly_participants_clan_member_id_idx` ON `weekly_participants` (`clan_member_id`);