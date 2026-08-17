CREATE TABLE "clan_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer,
	"event_type" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"actor_user_id" integer,
	"notes" text,
	"occurred_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"rsn" text NOT NULL,
	"rsn_normalized" text NOT NULL,
	"discord_id" text,
	"rank" text,
	"is_guest" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"joined_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"left_at" text,
	"last_seen_in_clan" text,
	"notes" text,
	"user_id" integer,
	"account_hash" text,
	"previous_rsns" text,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"verified_at" text,
	"verification_method" text,
	"verified_by_user_id" integer,
	"provisional" integer DEFAULT 0 NOT NULL,
	"claimed_at" text,
	"pending_role" text,
	"status" text DEFAULT 'active' NOT NULL,
	"status_last_checked" text,
	"live_stats" text,
	"live_stats_at" text,
	"live_stat_key_times" text,
	"stats_overall_xp" integer,
	"stats_miss_streak" integer DEFAULT 0 NOT NULL,
	"stats_next_due_at" text,
	"stats_last_snapshot" text,
	"stats_activities" text
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"tile_id" integer NOT NULL,
	"completed_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"credit_player_id" integer,
	"stat_contributions" text,
	"awarded_points" integer
);
--> statement-breakpoint
CREATE TABLE "detected_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"rsn" text NOT NULL,
	"rsn_normalized" text NOT NULL,
	"account_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"detected_at" text NOT NULL,
	"last_seen_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_shortlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"person_key" text NOT NULL,
	"position" integer NOT NULL,
	"note" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_editors" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"granted_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "event_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"scoring_mode" text NOT NULL,
	"board_size" integer NOT NULL,
	"tiles" text,
	"created_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer,
	"clan_member_id" integer NOT NULL,
	"profile_data" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"exclude_from_prize_pool" boolean DEFAULT false NOT NULL,
	"signed_up_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_start_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer,
	"rsn" text,
	"image_url" text NOT NULL,
	"source" text NOT NULL,
	"keyword" text,
	"keyword_ok" boolean DEFAULT false NOT NULL,
	"captured_at" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" integer,
	"reviewed_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"board_size" integer NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"draft_status" text DEFAULT 'none' NOT NULL,
	"draft_order" text,
	"start_date" text,
	"end_date" text,
	"start_notified" integer DEFAULT 0,
	"end_notified" integer DEFAULT 0,
	"start_hold_notified" integer DEFAULT 0,
	"draft_notified" integer DEFAULT 0,
	"draft_start_notified" integer DEFAULT 0,
	"force_ended_at" text,
	"original_end_date" text,
	"signup_fee" integer,
	"added_prize_pool" integer,
	"signup_opens_at" text,
	"signup_deadline" text,
	"payment_deadline" text,
	"captain_selection_deadline" text,
	"scoring_mode" text DEFAULT 'tiles' NOT NULL,
	"format" text DEFAULT 'bingo' NOT NULL,
	"discord_category_id" text,
	"tiles_revealed" integer DEFAULT 0 NOT NULL,
	"max_accounts_per_person" integer DEFAULT 1 NOT NULL,
	"account_slot_mode" text DEFAULT 'per-person' NOT NULL,
	"fee_mode" text DEFAULT 'per-person' NOT NULL,
	"payouts_announced_at" text,
	"placement_prizes" text,
	"rules" text,
	"edit_unlocked_at" text,
	"start_proof_location" text,
	"start_proof_drawn_at" text
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'bug' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"user_id" integer,
	"contact" text,
	"page_url" text,
	"admin_notes" text,
	"elevated" boolean DEFAULT false NOT NULL,
	"elevated_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_clog" (
	"clan_member_id" integer PRIMARY KEY NOT NULL,
	"pages_synced" integer DEFAULT 0 NOT NULL,
	"pages_total" integer DEFAULT 0 NOT NULL,
	"obtained" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"account_hash" text,
	"synced_at" text NOT NULL,
	"plugin_version" text
);
--> statement-breakpoint
CREATE TABLE "member_clog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"page_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"first_seen_at" text,
	"kc_at_unlock" integer
);
--> statement-breakpoint
CREATE TABLE "member_clog_kc" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"page_name" text NOT NULL,
	"label" text NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"day" text NOT NULL,
	"overall_xp" integer NOT NULL,
	"ehp_milli" integer DEFAULT 0 NOT NULL,
	"ehb_milli" integer DEFAULT 0 NOT NULL,
	"xp_gained" integer DEFAULT 0 NOT NULL,
	"ehp_milli_gained" integer DEFAULT 0 NOT NULL,
	"ehb_milli_gained" integer DEFAULT 0 NOT NULL,
	"deltas" text,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"kind" text NOT NULL,
	"metric" text,
	"threshold" integer NOT NULL,
	"noticed_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_personal_bests" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"activity" text NOT NULL,
	"team_size" integer DEFAULT 0 NOT NULL,
	"centis" integer NOT NULL,
	"achieved_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"clan_member_id" integer,
	"rsn" text NOT NULL,
	"team_id" integer,
	"team_name" text,
	"place" integer,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"proof_blob_url" text,
	"paid_by_user_id" integer,
	"paid_at" text,
	"notes" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_notifications" (
	"tile_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"pending_amount" integer DEFAULT 0 NOT NULL,
	"latest_total" integer,
	"required_amount" integer,
	"latest_image_url" text,
	"latest_note" text,
	"latest_credit_name" text,
	"completed" integer DEFAULT 0 NOT NULL,
	"first_queued_at" text NOT NULL,
	"last_event_at" text NOT NULL,
	CONSTRAINT "pending_notifications_tile_id_team_id_pk" PRIMARY KEY("tile_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "pending_renames" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"old_rsn" text NOT NULL,
	"new_rsn" text NOT NULL,
	"old_rsn_normalized" text NOT NULL,
	"new_rsn_normalized" text NOT NULL,
	"old_snapshot" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"submitted_by_user_id" integer,
	"reviewed_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_event_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"person_key" text NOT NULL,
	"clan_member_id" integer,
	"user_id" integer,
	"rsn" text NOT NULL,
	"accounts" integer DEFAULT 1 NOT NULL,
	"team_id" integer,
	"points" real DEFAULT 0 NOT NULL,
	"tiles_contributed" integer DEFAULT 0 NOT NULL,
	"tiles_finished" integer DEFAULT 0 NOT NULL,
	"submissions" integer DEFAULT 0 NOT NULL,
	"xp_gained" integer DEFAULT 0 NOT NULL,
	"kc_gained" integer DEFAULT 0 NOT NULL,
	"deaths" integer DEFAULT 0 NOT NULL,
	"loot_gp_gained" integer DEFAULT 0 NOT NULL,
	"pvp_kills" integer DEFAULT 0 NOT NULL,
	"active_days" integer DEFAULT 0 NOT NULL,
	"last_active_day" integer,
	"event_days" integer,
	"subbed_out" integer DEFAULT 0 NOT NULL,
	"team_rank" integer,
	"teams_total" integer,
	"team_points" real,
	"top_team_points" real,
	"detail" text,
	"computed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_member_id" integer NOT NULL,
	"weekly_competition_id" integer,
	"kind" text DEFAULT 'current' NOT NULL,
	"captured_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"payload" text NOT NULL,
	"overall_xp" integer
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"clan_member_id" integer,
	"name" text NOT NULL,
	"discord" text,
	"timezone" text,
	"team_id" integer,
	"pick_number" integer,
	"picked_at" text,
	"stats_snapshot" text,
	"snapshot_at" text,
	"player_token" text,
	"cached_stats" text,
	"last_stats_fetch" text,
	"plugin_stats" text,
	"frozen_at" text,
	"frozen_stats" text,
	"deaths" integer DEFAULT 0,
	"loot_gp_gained" integer DEFAULT 0,
	"pvp_kills" integer DEFAULT 0,
	"biggest_hit" integer DEFAULT 0,
	"minutes_played" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "plugin_device_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" integer,
	"interval" integer DEFAULT 5 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"expires_at" text NOT NULL,
	"last_polled_at" text
);
--> statement-breakpoint
CREATE TABLE "plugin_link_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" text NOT NULL,
	"expires_at" text NOT NULL,
	"consumed_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"last_used_at" text,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "signup_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"signup_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"collected_by_user_id" integer,
	"collected_at" text,
	"reported_collector_user_id" integer,
	"reported_at" text,
	"proof_blob_url" text,
	"confirmed_by_user_id" integer,
	"confirmed_at" text,
	"confirmations" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tile_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer,
	"credit_player_id" integer,
	"amount" integer DEFAULT 1 NOT NULL,
	"image_url" text,
	"note" text,
	"item_id" integer,
	"duration_seconds" integer,
	"coop_group" text,
	"coop_party_size" integer,
	"flagged_reason" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"prompt" text NOT NULL,
	"options" text,
	"required" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer,
	"answers" text NOT NULL,
	"submitted_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"granted_by_user_id" integer,
	"note" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"captain_password" text,
	"captain_user_id" integer,
	"discord_role_id" text,
	"discord_text_channel_id" text,
	"discord_voice_channel_id" text
);
--> statement-breakpoint
CREATE TABLE "tile_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"tile_id" integer,
	"tile_label" text,
	"action" text NOT NULL,
	"changed_fields" text,
	"old_value" text,
	"new_value" text,
	"actor_user_id" integer,
	"occurred_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tile_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"tile_type" text DEFAULT 'standard' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"category" text,
	"config" text NOT NULL,
	"seed_key" text,
	"source_event_id" integer,
	"created_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tile_locks" (
	"tile_id" integer PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"username" text NOT NULL,
	"acquired_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"icon" text,
	"description" text,
	"tile_type" text DEFAULT 'standard' NOT NULL,
	"required_amount" integer,
	"tracked_stat" text,
	"stat_type" text,
	"stat_goal" integer,
	"tracking_mode" text DEFAULT 'team' NOT NULL,
	"optional" integer DEFAULT 0,
	"auto_track_disabled" integer DEFAULT 0 NOT NULL,
	"tracked_item_ids" text,
	"item_requirements" text,
	"group_mode" text,
	"per_kill_cap" integer,
	"coop_credit" text,
	"coop_min_members" integer,
	"accepted_sources" text,
	"source_npcs" text,
	"target_npcs" text,
	"timed_activity" text,
	"time_threshold_seconds" integer,
	"party_size" integer,
	"pvp_min_loot_value" integer,
	"category" text,
	"points" integer DEFAULT 1 NOT NULL,
	"updated_at" text,
	"reveal_at" text,
	"revealed_at" text,
	"closed_at" text,
	"mission" integer DEFAULT 0 NOT NULL,
	"rules" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'member' NOT NULL,
	"editor_scope" text DEFAULT 'all' NOT NULL,
	"can_edit_tiles" boolean DEFAULT false NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"banned_at" text,
	"banned_reason" text,
	"banned_by_user_id" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"created_by" integer,
	"discord_id" text,
	"discord_username" text,
	"discord_avatar" text,
	"email" text,
	"last_login_at" text,
	"plugin_token" text,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "verification_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"rsn" text NOT NULL,
	"rsn_normalized" text NOT NULL,
	"baseline_snapshot" text NOT NULL,
	"min_delta" integer DEFAULT 1000 NOT NULL,
	"expires_at" text NOT NULL,
	"completed_at" text,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"metric" text NOT NULL,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"created_by_id" integer,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"include_guests" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"clan_member_id" integer,
	"rsn" text NOT NULL,
	"rsn_normalized" text NOT NULL,
	"baseline_value" integer,
	"current_value" integer,
	"last_updated" text,
	"flagged" integer DEFAULT 0 NOT NULL,
	"flag_reason" text,
	"keep_if_left" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clan_audit_log" ADD CONSTRAINT "clan_audit_log_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_audit_log" ADD CONSTRAINT "clan_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_tile_id_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."tiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_credit_player_id_players_id_fk" FOREIGN KEY ("credit_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_accounts" ADD CONSTRAINT "detected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_shortlists" ADD CONSTRAINT "draft_shortlists_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_shortlists" ADD CONSTRAINT "draft_shortlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_editors" ADD CONSTRAINT "event_editors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_editors" ADD CONSTRAINT "event_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_editors" ADD CONSTRAINT "event_editors_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_presets" ADD CONSTRAINT "event_presets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD CONSTRAINT "event_start_proofs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD CONSTRAINT "event_start_proofs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD CONSTRAINT "event_start_proofs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_start_proofs" ADD CONSTRAINT "event_start_proofs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog" ADD CONSTRAINT "member_clog_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog_items" ADD CONSTRAINT "member_clog_items_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_clog_kc" ADD CONSTRAINT "member_clog_kc_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_daily_stats" ADD CONSTRAINT "member_daily_stats_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_personal_bests" ADD CONSTRAINT "member_personal_bests_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_tile_id_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."tiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_renames" ADD CONSTRAINT "pending_renames_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_renames" ADD CONSTRAINT "pending_renames_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_facts" ADD CONSTRAINT "player_event_facts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_facts" ADD CONSTRAINT "player_event_facts_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_facts" ADD CONSTRAINT "player_event_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_event_facts" ADD CONSTRAINT "player_event_facts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_snapshots" ADD CONSTRAINT "player_snapshots_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_snapshots" ADD CONSTRAINT "player_snapshots_weekly_competition_id_weekly_competitions_id_fk" FOREIGN KEY ("weekly_competition_id") REFERENCES "public"."weekly_competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_device_codes" ADD CONSTRAINT "plugin_device_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_link_codes" ADD CONSTRAINT "plugin_link_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_links" ADD CONSTRAINT "plugin_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_fees" ADD CONSTRAINT "signup_fees_signup_id_event_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."event_signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_fees" ADD CONSTRAINT "signup_fees_collected_by_user_id_users_id_fk" FOREIGN KEY ("collected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_fees" ADD CONSTRAINT "signup_fees_reported_collector_user_id_users_id_fk" FOREIGN KEY ("reported_collector_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_fees" ADD CONSTRAINT "signup_fees_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tile_id_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."tiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_credit_player_id_players_id_fk" FOREIGN KEY ("credit_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_staff" ADD CONSTRAINT "team_staff_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_staff" ADD CONSTRAINT "team_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_staff" ADD CONSTRAINT "team_staff_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_user_id_users_id_fk" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_audit_log" ADD CONSTRAINT "tile_audit_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_audit_log" ADD CONSTRAINT "tile_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_library" ADD CONSTRAINT "tile_library_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_library" ADD CONSTRAINT "tile_library_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_locks" ADD CONSTRAINT "tile_locks_tile_id_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."tiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiles" ADD CONSTRAINT "tiles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_competitions" ADD CONSTRAINT "weekly_competitions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD CONSTRAINT "weekly_participants_competition_id_weekly_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."weekly_competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_participants" ADD CONSTRAINT "weekly_participants_clan_member_id_clan_members_id_fk" FOREIGN KEY ("clan_member_id") REFERENCES "public"."clan_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clan_audit_log_member_id_idx" ON "clan_audit_log" USING btree ("clan_member_id");--> statement-breakpoint
CREATE INDEX "clan_audit_log_occurred_at_idx" ON "clan_audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "clan_audit_log_event_type_idx" ON "clan_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_rsn_normalized_unique" ON "clan_members" USING btree ("rsn_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_account_hash_unique" ON "clan_members" USING btree ("account_hash");--> statement-breakpoint
CREATE INDEX "clan_members_left_at_idx" ON "clan_members" USING btree ("left_at");--> statement-breakpoint
CREATE INDEX "clan_members_user_id_idx" ON "clan_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clan_members_provisional_idx" ON "clan_members" USING btree ("provisional");--> statement-breakpoint
CREATE INDEX "clan_members_status_idx" ON "clan_members" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_tile_unique" ON "completions" USING btree ("team_id","tile_id");--> statement-breakpoint
CREATE INDEX "completions_tile_id_idx" ON "completions" USING btree ("tile_id");--> statement-breakpoint
CREATE INDEX "completions_team_id_idx" ON "completions" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "detected_accounts_user_rsn_unique" ON "detected_accounts" USING btree ("user_id","rsn_normalized");--> statement-breakpoint
CREATE INDEX "detected_accounts_user_id_idx" ON "detected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "detected_accounts_status_idx" ON "detected_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_shortlists_unique" ON "draft_shortlists" USING btree ("event_id","user_id","person_key");--> statement-breakpoint
CREATE INDEX "draft_shortlists_owner_idx" ON "draft_shortlists" USING btree ("event_id","user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "event_editors_event_user_unique" ON "event_editors" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_editors_user_idx" ON "event_editors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_presets_created_at_idx" ON "event_presets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_signup_member_unique" ON "event_signups" USING btree ("event_id","clan_member_id");--> statement-breakpoint
CREATE INDEX "event_signup_event_user_idx" ON "event_signups" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_signups_event_id_idx" ON "event_signups" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_signups_user_id_idx" ON "event_signups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_signups_clan_member_id_idx" ON "event_signups" USING btree ("clan_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_start_proof_player_unique" ON "event_start_proofs" USING btree ("event_id","player_id");--> statement-breakpoint
CREATE INDEX "event_start_proof_event_status_idx" ON "event_start_proofs" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "member_clog_synced_idx" ON "member_clog" USING btree ("synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_clog_items_unique" ON "member_clog_items" USING btree ("clan_member_id","item_id");--> statement-breakpoint
CREATE INDEX "member_clog_items_item_idx" ON "member_clog_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "member_clog_items_page_idx" ON "member_clog_items" USING btree ("clan_member_id","page_name");--> statement-breakpoint
CREATE UNIQUE INDEX "member_clog_kc_unique" ON "member_clog_kc" USING btree ("clan_member_id","page_name","label");--> statement-breakpoint
CREATE UNIQUE INDEX "member_daily_stats_member_day_idx" ON "member_daily_stats" USING btree ("clan_member_id","day");--> statement-breakpoint
CREATE INDEX "member_daily_stats_day_idx" ON "member_daily_stats" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "member_milestones_unique" ON "member_milestones" USING btree ("clan_member_id","kind","metric","threshold");--> statement-breakpoint
CREATE INDEX "member_milestones_member_idx" ON "member_milestones" USING btree ("clan_member_id","noticed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_pb_unique" ON "member_personal_bests" USING btree ("clan_member_id","activity","team_size");--> statement-breakpoint
CREATE INDEX "member_pb_activity_idx" ON "member_personal_bests" USING btree ("activity","centis");--> statement-breakpoint
CREATE INDEX "payouts_event_id_idx" ON "payouts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_event_member_unique" ON "payouts" USING btree ("event_id","clan_member_id");--> statement-breakpoint
CREATE INDEX "pending_notifications_last_event_idx" ON "pending_notifications" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "pending_renames_status_idx" ON "pending_renames" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_renames_member_idx" ON "pending_renames" USING btree ("clan_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_event_facts_event_person_idx" ON "player_event_facts" USING btree ("event_id","person_key");--> statement-breakpoint
CREATE INDEX "player_event_facts_person_idx" ON "player_event_facts" USING btree ("person_key");--> statement-breakpoint
CREATE INDEX "player_snapshots_member_captured_idx" ON "player_snapshots" USING btree ("clan_member_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_snapshots_member_comp_kind_idx" ON "player_snapshots" USING btree ("clan_member_id","weekly_competition_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "player_token_unique" ON "players" USING btree ("player_token");--> statement-breakpoint
CREATE INDEX "players_event_id_idx" ON "players" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "players_event_team_idx" ON "players" USING btree ("event_id","team_id");--> statement-breakpoint
CREATE INDEX "players_clan_member_id_idx" ON "players" USING btree ("clan_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_device_codes_hash_unique" ON "plugin_device_codes" USING btree ("device_code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_device_codes_user_code_unique" ON "plugin_device_codes" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "plugin_device_codes_expires_idx" ON "plugin_device_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_link_codes_code_unique" ON "plugin_link_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "plugin_link_codes_user_id_idx" ON "plugin_link_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_links_token_unique" ON "plugin_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "plugin_links_user_id_idx" ON "plugin_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signup_fees_signup_unique" ON "signup_fees" USING btree ("signup_id");--> statement-breakpoint
CREATE INDEX "signup_fees_status_idx" ON "signup_fees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_tile_id_idx" ON "submissions" USING btree ("tile_id");--> statement-breakpoint
CREATE INDEX "submissions_team_id_idx" ON "submissions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "submissions_tile_team_idx" ON "submissions" USING btree ("tile_id","team_id");--> statement-breakpoint
CREATE INDEX "survey_questions_event_id_idx" ON "survey_questions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_event_user_unique" ON "survey_responses" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "survey_responses_event_id_idx" ON "survey_responses" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_staff_team_user_unique" ON "team_staff" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_staff_user_idx" ON "team_staff" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_event_id_idx" ON "teams" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "teams_captain_user_id_idx" ON "teams" USING btree ("captain_user_id");--> statement-breakpoint
CREATE INDEX "tile_audit_log_event_id_idx" ON "tile_audit_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tile_audit_log_occurred_at_idx" ON "tile_audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "tile_audit_log_tile_id_idx" ON "tile_audit_log" USING btree ("tile_id");--> statement-breakpoint
CREATE INDEX "tile_library_points_idx" ON "tile_library" USING btree ("points");--> statement-breakpoint
CREATE INDEX "tile_library_category_idx" ON "tile_library" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "tile_library_seed_key_idx" ON "tile_library" USING btree ("seed_key");--> statement-breakpoint
CREATE INDEX "tiles_event_id_idx" ON "tiles" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_plugin_token_unique" ON "users" USING btree ("plugin_token");--> statement-breakpoint
CREATE INDEX "verification_attempts_user_id_idx" ON "verification_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_attempts_rsn_normalized_idx" ON "verification_attempts" USING btree ("rsn_normalized");--> statement-breakpoint
CREATE INDEX "verification_attempts_expires_at_idx" ON "verification_attempts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_participant_unique" ON "weekly_participants" USING btree ("competition_id","rsn_normalized");--> statement-breakpoint
CREATE INDEX "weekly_participants_comp_id_idx" ON "weekly_participants" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "weekly_participants_clan_member_id_idx" ON "weekly_participants" USING btree ("clan_member_id");