DROP INDEX `event_signup_user_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `event_signup_member_unique` ON `event_signups` (`event_id`,`clan_member_id`);--> statement-breakpoint
CREATE INDEX `event_signup_event_user_idx` ON `event_signups` (`event_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `max_accounts_per_person` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `account_slot_mode` text DEFAULT 'per-person' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `fee_mode` text DEFAULT 'per-person' NOT NULL;