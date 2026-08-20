DROP INDEX `event_editors_event_user_unique`;--> statement-breakpoint
ALTER TABLE `event_editors` ADD `role` text DEFAULT 'editor' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `event_editors_event_user_role_unique` ON `event_editors` (`event_id`,`user_id`,`role`);--> statement-breakpoint
ALTER TABLE `users` ADD `treasurer_scope` text DEFAULT 'all' NOT NULL;