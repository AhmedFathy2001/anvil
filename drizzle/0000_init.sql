CREATE TABLE `clan_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clan_member_id` integer,
	`event_type` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`actor_user_id` integer,
	`notes` text,
	`occurred_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `clan_audit_log_member_id_idx` ON `clan_audit_log` (`clan_member_id`);--> statement-breakpoint
CREATE INDEX `clan_audit_log_occurred_at_idx` ON `clan_audit_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `clan_audit_log_event_type_idx` ON `clan_audit_log` (`event_type`);--> statement-breakpoint
CREATE TABLE `clan_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rsn` text NOT NULL,
	`rsn_normalized` text NOT NULL,
	`discord_id` text,
	`rank` text,
	`is_guest` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	`left_at` text,
	`last_seen_in_clan` text,
	`notes` text,
	`user_id` integer,
	`account_hash` text,
	`previous_rsns` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`verified_at` text,
	`verification_method` text,
	`verified_by_user_id` integer,
	`provisional` integer DEFAULT 0 NOT NULL,
	`claimed_at` text,
	`pending_role` text,
	`status` text DEFAULT 'active' NOT NULL,
	`status_last_checked` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clan_members_rsn_normalized_unique` ON `clan_members` (`rsn_normalized`);--> statement-breakpoint
CREATE UNIQUE INDEX `clan_members_account_hash_unique` ON `clan_members` (`account_hash`);--> statement-breakpoint
CREATE INDEX `clan_members_left_at_idx` ON `clan_members` (`left_at`);--> statement-breakpoint
CREATE INDEX `clan_members_user_id_idx` ON `clan_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `clan_members_provisional_idx` ON `clan_members` (`provisional`);--> statement-breakpoint
CREATE INDEX `clan_members_status_idx` ON `clan_members` (`status`);--> statement-breakpoint
CREATE TABLE `completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`tile_id` integer NOT NULL,
	`completed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tile_id`) REFERENCES `tiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_tile_unique` ON `completions` (`team_id`,`tile_id`);--> statement-breakpoint
CREATE INDEX `completions_tile_id_idx` ON `completions` (`tile_id`);--> statement-breakpoint
CREATE INDEX `completions_team_id_idx` ON `completions` (`team_id`);--> statement-breakpoint
CREATE TABLE `event_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`clan_member_id` integer NOT NULL,
	`profile_data` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`signed_up_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_signup_user_unique` ON `event_signups` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_signups_event_id_idx` ON `event_signups` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_signups_user_id_idx` ON `event_signups` (`user_id`);--> statement-breakpoint
CREATE INDEX `event_signups_clan_member_id_idx` ON `event_signups` (`clan_member_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`board_size` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`draft_status` text DEFAULT 'none' NOT NULL,
	`draft_order` text,
	`start_date` text,
	`end_date` text,
	`start_notified` integer DEFAULT 0,
	`end_notified` integer DEFAULT 0,
	`force_ended_at` text,
	`original_end_date` text,
	`signup_fee` integer,
	`added_prize_pool` integer,
	`signup_opens_at` text,
	`signup_deadline` text,
	`payment_deadline` text,
	`captain_selection_deadline` text,
	`scoring_mode` text DEFAULT 'tiles' NOT NULL,
	`format` text DEFAULT 'bingo' NOT NULL,
	`discord_category_id` text,
	`tiles_revealed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_notifications` (
	`tile_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`pending_amount` integer DEFAULT 0 NOT NULL,
	`latest_total` integer,
	`required_amount` integer,
	`latest_image_url` text,
	`latest_note` text,
	`latest_credit_name` text,
	`completed` integer DEFAULT 0 NOT NULL,
	`first_queued_at` text NOT NULL,
	`last_event_at` text NOT NULL,
	PRIMARY KEY(`tile_id`, `team_id`),
	FOREIGN KEY (`tile_id`) REFERENCES `tiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pending_notifications_last_event_idx` ON `pending_notifications` (`last_event_at`);--> statement-breakpoint
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
CREATE INDEX `player_snapshots_member_captured_idx` ON `player_snapshots` (`clan_member_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`clan_member_id` integer,
	`name` text NOT NULL,
	`discord` text,
	`timezone` text,
	`team_id` integer,
	`pick_number` integer,
	`picked_at` text,
	`stats_snapshot` text,
	`snapshot_at` text,
	`player_token` text,
	`cached_stats` text,
	`last_stats_fetch` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_token_unique` ON `players` (`player_token`);--> statement-breakpoint
CREATE INDEX `players_event_id_idx` ON `players` (`event_id`);--> statement-breakpoint
CREATE INDEX `players_event_team_idx` ON `players` (`event_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `players_clan_member_id_idx` ON `players` (`clan_member_id`);--> statement-breakpoint
CREATE TABLE `plugin_link_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`code` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_link_codes_code_unique` ON `plugin_link_codes` (`code`);--> statement-breakpoint
CREATE INDEX `plugin_link_codes_user_id_idx` ON `plugin_link_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `plugin_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_links_token_unique` ON `plugin_links` (`token`);--> statement-breakpoint
CREATE INDEX `plugin_links_user_id_idx` ON `plugin_links` (`user_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expires_at_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `signup_fees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`signup_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`collected_by_user_id` integer,
	`collected_at` text,
	`reported_collector_user_id` integer,
	`reported_at` text,
	`proof_blob_url` text,
	`confirmed_by_user_id` integer,
	`confirmed_at` text,
	`notes` text,
	FOREIGN KEY (`signup_id`) REFERENCES `event_signups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collected_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reported_collector_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signup_fees_signup_unique` ON `signup_fees` (`signup_id`);--> statement-breakpoint
CREATE INDEX `signup_fees_status_idx` ON `signup_fees` (`status`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tile_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer,
	`credit_player_id` integer,
	`amount` integer DEFAULT 1 NOT NULL,
	`image_url` text,
	`note` text,
	`item_id` integer,
	`duration_seconds` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tile_id`) REFERENCES `tiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`credit_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `submissions_tile_id_idx` ON `submissions` (`tile_id`);--> statement-breakpoint
CREATE INDEX `submissions_team_id_idx` ON `submissions` (`team_id`);--> statement-breakpoint
CREATE INDEX `submissions_tile_team_idx` ON `submissions` (`tile_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`captain_password` text,
	`captain_user_id` integer,
	`discord_role_id` text,
	`discord_text_channel_id` text,
	`discord_voice_channel_id` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`captain_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `teams_event_id_idx` ON `teams` (`event_id`);--> statement-breakpoint
CREATE INDEX `teams_captain_user_id_idx` ON `teams` (`captain_user_id`);--> statement-breakpoint
CREATE TABLE `tiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`icon` text,
	`description` text,
	`tile_type` text DEFAULT 'standard' NOT NULL,
	`required_amount` integer,
	`tracked_stat` text,
	`stat_type` text,
	`stat_goal` integer,
	`tracking_mode` text DEFAULT 'team' NOT NULL,
	`optional` integer DEFAULT 0,
	`tracked_item_ids` text,
	`item_requirements` text,
	`accepted_sources` text,
	`source_npcs` text,
	`target_npcs` text,
	`timed_activity` text,
	`time_threshold_seconds` integer,
	`category` text,
	`points` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tiles_event_id_idx` ON `tiles` (`event_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`display_name` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'member' NOT NULL,
	`is_owner` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_by` integer,
	`discord_id` text,
	`discord_username` text,
	`discord_avatar` text,
	`email` text,
	`last_login_at` text,
	`plugin_token` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_plugin_token_unique` ON `users` (`plugin_token`);--> statement-breakpoint
CREATE TABLE `verification_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`rsn` text NOT NULL,
	`rsn_normalized` text NOT NULL,
	`baseline_snapshot` text NOT NULL,
	`min_delta` integer DEFAULT 1000 NOT NULL,
	`expires_at` text NOT NULL,
	`completed_at` text,
	`succeeded` integer DEFAULT 0 NOT NULL,
	`failure_reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `verification_attempts_user_id_idx` ON `verification_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_attempts_rsn_normalized_idx` ON `verification_attempts` (`rsn_normalized`);--> statement-breakpoint
CREATE INDEX `verification_attempts_expires_at_idx` ON `verification_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `weekly_competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`metric` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_by_id` integer,
	`status` text DEFAULT 'upcoming' NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `weekly_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`clan_member_id` integer,
	`rsn` text NOT NULL,
	`rsn_normalized` text NOT NULL,
	`baseline_value` integer,
	`current_value` integer,
	`last_updated` text,
	`flagged` integer DEFAULT 0 NOT NULL,
	`flag_reason` text,
	`keep_if_left` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `weekly_competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_member_id`) REFERENCES `clan_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_participant_unique` ON `weekly_participants` (`competition_id`,`rsn_normalized`);--> statement-breakpoint
CREATE INDEX `weekly_participants_comp_id_idx` ON `weekly_participants` (`competition_id`);--> statement-breakpoint
CREATE INDEX `weekly_participants_clan_member_id_idx` ON `weekly_participants` (`clan_member_id`);