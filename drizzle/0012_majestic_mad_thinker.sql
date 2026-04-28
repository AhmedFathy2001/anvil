CREATE INDEX `completions_tile_id_idx` ON `completions` (`tile_id`);--> statement-breakpoint
CREATE INDEX `completions_team_id_idx` ON `completions` (`team_id`);--> statement-breakpoint
CREATE INDEX `players_event_id_idx` ON `players` (`event_id`);--> statement-breakpoint
CREATE INDEX `players_event_team_idx` ON `players` (`event_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `submissions_tile_id_idx` ON `submissions` (`tile_id`);--> statement-breakpoint
CREATE INDEX `submissions_team_id_idx` ON `submissions` (`team_id`);--> statement-breakpoint
CREATE INDEX `submissions_tile_team_idx` ON `submissions` (`tile_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `teams_event_id_idx` ON `teams` (`event_id`);--> statement-breakpoint
CREATE INDEX `tiles_event_id_idx` ON `tiles` (`event_id`);--> statement-breakpoint
CREATE INDEX `weekly_participants_comp_id_idx` ON `weekly_participants` (`competition_id`);