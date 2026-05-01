DROP INDEX "clan_audit_log_member_id_idx";--> statement-breakpoint
DROP INDEX "clan_audit_log_occurred_at_idx";--> statement-breakpoint
DROP INDEX "clan_audit_log_event_type_idx";--> statement-breakpoint
DROP INDEX "clan_members_rsn_normalized_unique";--> statement-breakpoint
DROP INDEX "clan_members_account_hash_unique";--> statement-breakpoint
DROP INDEX "clan_members_left_at_idx";--> statement-breakpoint
DROP INDEX "clan_members_user_id_idx";--> statement-breakpoint
DROP INDEX "clan_members_provisional_idx";--> statement-breakpoint
DROP INDEX "team_tile_unique";--> statement-breakpoint
DROP INDEX "completions_tile_id_idx";--> statement-breakpoint
DROP INDEX "completions_team_id_idx";--> statement-breakpoint
DROP INDEX "player_token_unique";--> statement-breakpoint
DROP INDEX "players_event_id_idx";--> statement-breakpoint
DROP INDEX "players_event_team_idx";--> statement-breakpoint
DROP INDEX "players_clan_member_id_idx";--> statement-breakpoint
DROP INDEX "plugin_link_codes_code_unique";--> statement-breakpoint
DROP INDEX "plugin_link_codes_user_id_idx";--> statement-breakpoint
DROP INDEX "plugin_links_token_unique";--> statement-breakpoint
DROP INDEX "plugin_links_user_id_idx";--> statement-breakpoint
DROP INDEX "rate_limits_expires_at_idx";--> statement-breakpoint
DROP INDEX "submissions_tile_id_idx";--> statement-breakpoint
DROP INDEX "submissions_team_id_idx";--> statement-breakpoint
DROP INDEX "submissions_tile_team_idx";--> statement-breakpoint
DROP INDEX "teams_event_id_idx";--> statement-breakpoint
DROP INDEX "teams_captain_user_id_idx";--> statement-breakpoint
DROP INDEX "tiles_event_id_idx";--> statement-breakpoint
DROP INDEX "users_username_unique";--> statement-breakpoint
DROP INDEX "users_discord_id_unique";--> statement-breakpoint
DROP INDEX "verification_attempts_user_id_idx";--> statement-breakpoint
DROP INDEX "verification_attempts_rsn_normalized_idx";--> statement-breakpoint
DROP INDEX "verification_attempts_expires_at_idx";--> statement-breakpoint
DROP INDEX "weekly_participant_unique";--> statement-breakpoint
DROP INDEX "weekly_participants_comp_id_idx";--> statement-breakpoint
DROP INDEX "weekly_participants_clan_member_id_idx";--> statement-breakpoint
ALTER TABLE `teams` ALTER COLUMN "captain_password" TO "captain_password" text;--> statement-breakpoint
CREATE INDEX `clan_audit_log_member_id_idx` ON `clan_audit_log` (`clan_member_id`);--> statement-breakpoint
CREATE INDEX `clan_audit_log_occurred_at_idx` ON `clan_audit_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `clan_audit_log_event_type_idx` ON `clan_audit_log` (`event_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `clan_members_rsn_normalized_unique` ON `clan_members` (`rsn_normalized`);--> statement-breakpoint
CREATE UNIQUE INDEX `clan_members_account_hash_unique` ON `clan_members` (`account_hash`);--> statement-breakpoint
CREATE INDEX `clan_members_left_at_idx` ON `clan_members` (`left_at`);--> statement-breakpoint
CREATE INDEX `clan_members_user_id_idx` ON `clan_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `clan_members_provisional_idx` ON `clan_members` (`provisional`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_tile_unique` ON `completions` (`team_id`,`tile_id`);--> statement-breakpoint
CREATE INDEX `completions_tile_id_idx` ON `completions` (`tile_id`);--> statement-breakpoint
CREATE INDEX `completions_team_id_idx` ON `completions` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_token_unique` ON `players` (`player_token`);--> statement-breakpoint
CREATE INDEX `players_event_id_idx` ON `players` (`event_id`);--> statement-breakpoint
CREATE INDEX `players_event_team_idx` ON `players` (`event_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `players_clan_member_id_idx` ON `players` (`clan_member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_link_codes_code_unique` ON `plugin_link_codes` (`code`);--> statement-breakpoint
CREATE INDEX `plugin_link_codes_user_id_idx` ON `plugin_link_codes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_links_token_unique` ON `plugin_links` (`token`);--> statement-breakpoint
CREATE INDEX `plugin_links_user_id_idx` ON `plugin_links` (`user_id`);--> statement-breakpoint
CREATE INDEX `rate_limits_expires_at_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX `submissions_tile_id_idx` ON `submissions` (`tile_id`);--> statement-breakpoint
CREATE INDEX `submissions_team_id_idx` ON `submissions` (`team_id`);--> statement-breakpoint
CREATE INDEX `submissions_tile_team_idx` ON `submissions` (`tile_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `teams_event_id_idx` ON `teams` (`event_id`);--> statement-breakpoint
CREATE INDEX `teams_captain_user_id_idx` ON `teams` (`captain_user_id`);--> statement-breakpoint
CREATE INDEX `tiles_event_id_idx` ON `tiles` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);--> statement-breakpoint
CREATE INDEX `verification_attempts_user_id_idx` ON `verification_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_attempts_rsn_normalized_idx` ON `verification_attempts` (`rsn_normalized`);--> statement-breakpoint
CREATE INDEX `verification_attempts_expires_at_idx` ON `verification_attempts` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_participant_unique` ON `weekly_participants` (`competition_id`,`rsn_normalized`);--> statement-breakpoint
CREATE INDEX `weekly_participants_comp_id_idx` ON `weekly_participants` (`competition_id`);--> statement-breakpoint
CREATE INDEX `weekly_participants_clan_member_id_idx` ON `weekly_participants` (`clan_member_id`);