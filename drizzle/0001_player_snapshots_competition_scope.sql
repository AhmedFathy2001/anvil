ALTER TABLE `player_snapshots` ADD `weekly_competition_id` integer REFERENCES weekly_competitions(id);--> statement-breakpoint
ALTER TABLE `player_snapshots` ADD `kind` text DEFAULT 'current' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `player_snapshots_member_comp_kind_idx` ON `player_snapshots` (`clan_member_id`,`weekly_competition_id`,`kind`);