ALTER TABLE `users` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `banned_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banned_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banned_by_user_id` integer;