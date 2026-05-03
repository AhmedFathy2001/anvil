ALTER TABLE `users` ADD `plugin_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_plugin_token_unique` ON `users` (`plugin_token`);